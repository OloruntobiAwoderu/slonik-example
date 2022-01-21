import express, { Request, Response, Express } from 'express';
import { createPool, NotFoundError, sql } from 'slonik';
import bodyParser from 'body-parser';
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import { env } from 'process'


const pool = createPool('postgresql://oloruntobiawoderu:@localhost:5432/slonik')

dotenv.config()
const app: Express = express();
const PORT: number = 8000;



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));



async function generateToken(user: any) {
	const payload = {
		subject: user.id,
		email: user.email
	};

	const options = {
		expiresIn: '2d'
	};
	try {
		const token = jwt.sign(payload, String(env.JWTSecret), options);
		return token;
	} catch (error: any) {
		return error.message;
	}
}



app.post('/', (req: Request, res: Response) => {
	try {

		const { first_name, lastname, email }: { first_name: string, lastname: string, email: string } = req.body

		pool.connect(async (connection) => {
			const result = await connection.many(sql`INSERT INTO users (first_name, lastname, email) VALUES (${first_name}, ${lastname}, ${email}) RETURNING *`)
			const token = await generateToken(result[0])
			return res.status(201).json({ result, token })
		})
	} catch (error) {
		if (!(error instanceof NotFoundError)) {
			return res.status(400).json('User was not created')
		}

	}


})
app.post('/balance', (req: Request, res: Response) => {
	try {
		const { authorization } = req.headers;
		const decoded: any = jwt.verify(String(authorization), String(env.JWTSecret));

		const { balance }: { balance: number } = req.body

		pool.connect(async (connection) => {
			const result = await connection.many(sql`UPDATE users SET balance = ${balance} WHERE users.id = ${decoded.subject} RETURNING *`)
			return res.status(200).json(result)
		})
	} catch (error) {
		if (!(error instanceof NotFoundError)) {
			return res.status(400).json('User was not found')
		}

	}
})

app.get('/user', (req: Request, res: Response) => {
	try {
		const { authorization } = req.headers;
		const decoded: any = jwt.verify(String(authorization), String(env.JWTSecret));
		pool.connect(async (connection) => {
			const result = await connection.many(sql`SELECT * FROM Users WHERE users.id = ${decoded.subject}`)
			return res.status(200).json(result)
		})
	} catch (error) {
		if (!(error instanceof NotFoundError)) {
			return res.status(400).json('User was not found')
		}

	}

})

app.post('/transfer', (req: Request, res: Response) => {
	const { amount, destinationEmail }: { amount: number, destinationEmail: string } = req.body
	const { authorization } = req.headers;
	const decoded: any = jwt.verify(String(authorization), String(env.JWTSecret));
	pool.transaction(async (connection) => {
		await connection.query(sql`UPDATE users SET balance = balance + ${amount} WHERE users.email = ${destinationEmail}`);
		await connection.query(sql`UPDATE users SET balance = balance - ${amount} WHERE users.id = ${decoded.subject}`);
		await connection.query(sql`INSERT INTO transactions (sent_from_email, sent_to, amount) VALUES (${decoded.email}, ${destinationEmail}, ${amount})`)
		return res.status(200).json("transfer successfully completed")
	})

})
app.get('/transactions', (req: Request, res: Response) => {
	const { authorization } = req.headers;
	const decoded: any = jwt.verify(String(authorization), String(env.JWTSecret));
	pool.connect(async (connection) => {
		const result = await connection.many(sql`SELECT * FROM transactions WHERE transactions.sent_to = ${decoded.email} OR transactions.sent_from_email = ${decoded.email}`)
		return res.status(200).json(result)
	})
})

app.listen(PORT, () => {
	console.log(`[server]: Server is running at https://localhost:${PORT}`);
});