const mongoose = require('mongoose');

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://localhost:27017/test');
}

//SCHEMA FOR USER MODEL
const userSchema = new mongoose.Schema({
    uid: String,
    email: String,
    password: String,
    date: {
        type: Date,
        default: Date.now
    }
});

//POST MODEL
const postSchema = new mongoose.Schema({
    pid: String,
    title: String,
    content: String,
    imageUri: String,
    tags: [String],
    date: {
        type: Date,
        default: Date.now
    }
})
;
//USER PROFILE MODEL
const profileSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    bio: String,
    birthdate: Date,
    likes:[String],
    followers: [String],
    following: [String],
})
