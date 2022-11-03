const mongoose = require('mongoose');
const express = require('express');

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
    }
});

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
    const user = new User({username, email, password});
    await user.save();
    res.send(user);
})

app.post("/posts/create", async (req, res) => {
    var { username, pid, title, content, imageUri, tags } = req.body;
    const post = new Post({username, pid, title, content, imageUri, tags});
    await post.save();
    res.send(post);
});

app.listen(3000, () => console.log("Server started"));