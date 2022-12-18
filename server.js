const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const upload = multer({dest: 'uploads/'})
const jwt = require('jsonwebtoken');
const secret = 'testingsecret';
const expiration = '1h';

const bcrypt = require('bcrypt');

function withAuth(req, res, next) {
    // console.log(req.headers)
    let token = req.body.token || req.query.token || req.headers['authorization'];
    // console.log(token)
    if (token) {
        try {
            const {user} = jwt.verify(token, secret, { maxAge: expiration }).data;
            req.user = user
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
    // console.log(result);
    // console.log(attempt);
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
    likes:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:'Post'
        }
    ],
    followers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:'User'
        }
    ],
    following: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:'User'
        }
    ],
})

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Profile = mongoose.model('Profile', profileSchema);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors())
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname,"uploads")))

app.get("/users/search" , async (req, res) => {
    var { email } = req.body;
    const users = await User.find();
    res.send(users);
});

app.get("/users/:username", async (req, res) => {
    console.log()
    const user = await User.findOne({username: req.params.username}).populate('posts profile');
    res.send(user);
})

app.post("/users/create", async (req, res) => {
    try {
    console.log(req);
    var { username, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({username, email, passwordHash});
    await user.save();
    res.send(user);
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
})

app.post("/users/login", async (req, res) => {
    var { username, password } = req.body;
    const user = await User.findOne({username});
    if (user && user.checkPassword(password)) {
        const token = signToken(user);
        res.cookie('token', token, { httpOnly: true });
        res.json({token});
    } else {
        res.status(401).json({message: 'Invalid credentials'});
    }
})

app.post("/posts/create", [withAuth, upload.single("image")], async (req, res) => {
    const user = await User.findOne({_id: req.user._id});
    console.log(user)
    if (user){
        console.log(req.body)
        var username = user.username
        var imageUri = ""
        if (req.file){
            imageUri = req.file.path
        }
        var { title, content, tags } = req.body;
        const post = new Post({ username, title, content, imageUri, tags });
        await post.save();
        console.log(post)
        user.posts.push(post._id);
        await user.save();
        res.send(post);
    } else {
        res.status(401).json({message: 'Invalid credentials'});
    }
    
});

app.post("/profiles/create", withAuth, async (req, res) => {
    const user = await User.findOne({username: req.user.username});
    if (user){
        var username = req.user.username
        var { bio, birthdate, likes, followers, following } = req.body;
        const profile = new Profile({ username, bio, birthdate, likes, followers, following});
        await profile.save();
        user.profile = (profile._id);
        await user.save();
        res.send(profile);
    }
}
)

app.listen(3001, () => console.log("Server started"));