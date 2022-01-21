"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const slonik_1 = require("slonik");
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const process_1 = require("process");
const pool = (0, slonik_1.createPool)('postgresql://oloruntobiawoderu:@localhost:5432/slonik');
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = 8000;
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.get('/', (req, res) => {
    pool.connect((connection) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield connection.oneFirst((0, slonik_1.sql) `SELECT * FROM users`);
        return res.status(200).json(result);
    }));
});
function generateToken(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = {
            subject: user.id,
            email: user.email
        };
        const options = {
            expiresIn: '2d'
        };
        try {
            const token = jsonwebtoken_1.default.sign(payload, String(process_1.env.JWTSecret), options);
            return token;
        }
        catch (error) {
            return error.message;
        }
    });
}
app.post('/', (req, res) => {
    const { first_name, lastname, email } = req.body;
    pool.transaction((connection) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield connection.many((0, slonik_1.sql) `INSERT INTO users (first_name, lastname, email) VALUES (${first_name}, ${lastname}, ${email}) RETURNING *`);
        const token = yield generateToken(result[0]);
        return res.status(201).json({ result, token });
    }));
});
app.post('/balance', (req, res) => {
    const { authorization } = req.headers;
    const decoded = jsonwebtoken_1.default.verify(String(authorization), String(process_1.env.JWTSecret));
    const { balance } = req.body;
    pool.connect((connection) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield connection.many((0, slonik_1.sql) `UPDATE users SET balance = ${balance} WHERE users.id = ${decoded.subject} RETURNING *`);
        return res.status(200).json(result);
    }));
});
app.get('/user', (req, res) => {
    const { authorization } = req.headers;
    const decoded = jsonwebtoken_1.default.verify(String(authorization), String(process_1.env.JWTSecret));
    pool.connect((connection) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield connection.many((0, slonik_1.sql) `SELECT * FROM Users WHERE users.id = ${decoded.subject}`);
        return res.status(200).json(result);
    }));
});
app.post('/transfer', (req, res) => {
    const { amount, destinationEmail } = req.body;
    const { authorization } = req.headers;
    const decoded = jsonwebtoken_1.default.verify(String(authorization), String(process_1.env.JWTSecret));
    pool.transaction((connection) => __awaiter(void 0, void 0, void 0, function* () {
        yield connection.query((0, slonik_1.sql) `UPDATE users SET balance = balance + ${amount} WHERE users.email = ${destinationEmail}`);
        yield connection.query((0, slonik_1.sql) `UPDATE users SET balance = balance - ${amount} WHERE users.id = ${decoded.subject}`);
        yield connection.query((0, slonik_1.sql) `INSERT INTO transactions (sent_from_email, sent_to, amount) VALUES (${decoded.email}, ${destinationEmail}, ${amount})`);
        return res.status(200).json("transfer successfully completed");
    }));
});
app.get('/transactions', (req, res) => {
    const { authorization } = req.headers;
    const decoded = jsonwebtoken_1.default.verify(String(authorization), String(process_1.env.JWTSecret));
    pool.connect((connection) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield connection.many((0, slonik_1.sql) `SELECT * FROM transactions WHERE transactions.sent_to = ${decoded.email} OR transactions.sent_from_email = ${decoded.email}`);
        return res.status(200).json(result);
    }));
});
app.listen(PORT, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${PORT}`);
});
