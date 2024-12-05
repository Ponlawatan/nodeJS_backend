const mongoose = require('mongoose');
const chalk = require('chalk');
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });
const { MONGODBDATABASEURI } = process.env;


const connectMongoDB = async () => {
    await mongoose.connect(MONGODBDATABASEURI, { dbName: 'healworld'}, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
        console.log(chalk.green("MongoDB Connected"))
    })
    .catch(err => console.error(err));
}

module.exports = connectMongoDB;