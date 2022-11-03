const mongoose = require('mongoose');
const express = require('express');

const jwt = require('jsonwebtoken');
const secret = 'testingsecret';
const expiration = '1h';

const bcrypt = require('bcrypt');

function withAuth(req, res, next) {
    console.log(req.headers)
    let token = req.body.token || req.query.token || req.headers['authorization'];
    console.log(token)
    if (token) {
        try {
            const { user } = jwt.verify(token, secret, { maxAge: expiration });
            req.user = user;
            console.log('next');
            next();
        }
        catch (err) {
            res.status(401).json({message: 'Invalid token'});
        }
    } else {
        res.status(401).json({message: 'No token provided'});
        return req;
    }
}

function signToken(user) {
    const payload = { user };
    return jwt.sign({ data: payload }, secret, { expiresIn: expiration });
}

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://localhost:27017/test');
}

//FUNCTION TO COLLECT PERSONAL DATA


//SCHEMA FOR USER MODEL



const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },
    passwordHash: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        match: [/.+@.+\..+/, 'Must match an email address!'],
      },
    password: String,
    date: {
        type: Date,
        default: Date.now
    },
    posts: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:'Post'
        }
    ],
    profile: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Profile'
    },
});

function checkPassword(attempt) {

    const result = bcrypt.compareSync(attempt, this.passwordHash);
    console.log(result);
    console.log(attempt);
    return result;

}

userSchema.methods.checkPassword = checkPassword;

//POST MODEL
const postSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
      },
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
    bio: String,
    birthdate: Date,
    likes:[String],
    followers: [String],
    following: [String],
})

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Profile = mongoose.model('Profile', profileSchema);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/users/search" , async (req, res) => {
    var { email } = req.body;
    const users = await User.find();
    res.send(users);
});

app.get("/users/:username", async (req, res) => {
    const users = await User.find({username: req.params.username});
    res.send(users);
})

app.post("/users/create", async (req, res) => {
    console.log(req);
    var { username, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({username, email, passwordHash});
    await user.save();
    res.send(user);
})

app.post("/users/login", async (req, res) => {
    var { username, password } = req.body;
    const user = await User.findOne({username});
    if (user && user.checkPassword(password)) {
        const token = signToken(user);
        res.json({token});
    } else {
        res.status(401).json({message: 'Invalid credentials'});
    }
})

app.post("/posts/create", withAuth, async (req, res) => {
    var { username, title, content, imageUri, tags } = req.body;
    const post = new Post({username, title, content, imageUri, tags});
    await post.save();
    res.send(post);
});

app.listen(3000, () => console.log("Server started"));