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
const { runInNewContext } = require('vm');

function withAuth(req, res, next) {
    // console.log(req.headers)
    let token = req.body.token || req.query.token || req.headers['authorization'];
    // console.log(token)
    if (token) {
        if (token.match(/^bearer/i)) {
            token = token.split(' ')[1]
        }
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
    if (process.env.ATLAS_DB) {
        await mongoose.connect(process.env.ATLAS_DB);
    } else {
    await mongoose.connect('mongodb://localhost:27017/test3');
    }
}
//FUNCTION TO COLLECT PERSONAL DATA


//SCHEMA FOR USER MODEL


//USER PROFILE SCHEMA
const profileSchema = new mongoose.Schema({
    image: String,
    bio: String,
    tags: [String],
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
    followedTags: [String]
})

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
    profile: profileSchema,
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
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
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
    },
    repost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    }
})
;


const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors())
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname,"uploads")))

app.get("/users/search" , async (req, res) => {
    var { usernames, text, tags } = req.query;

    tags = tags ? tags.split(',') : [];
    usernames = usernames? usernames.split(',') : [];
    console.log(req.query);
    const usernameMatches = await User.find({username:{$in:usernames}})//({$or: [{username: username}, {tags: {$in:tags}}]});
    let tagsMatches =  await User.find({"profile.tags": {$in:tags}});
    res.send([...usernameMatches, ...tagsMatches]);
});

app.get("/users/:username", async (req, res) => {
    console.log()
    const user = await User.findOne({username: req.params.username}).populate({path:"posts", options: {sort: {date: -1}}});
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

app.put("/users/edit", [withAuth, upload.single("image")], async (req, res) => {
    try {
        if (req.body.password)
        {
            req.body.password = bcrypt.hash(password, 10);
        }
        if (req.file) {
            req.body.image = req.file.path
        }
        console.log(req.user, req.body);
        const result = await User.findByIdAndUpdate(req.user._id, {
            $set: {profile:req.body}
        } )
        res.json(result)
    } catch (err) {
        res.status(500).json({message: err.message});
    }
}
)

app.get('/me', withAuth, async (req, res) => {
        try {
            const user = await User.findOne({_id: req.user._id}).populate(["posts", "profile.following", "profile.likes"])
            if (user) {
                res.status(200).json(user);
            }
        }
        catch (err) {
            res.status(500).json({message: err.message});
        }
    }
)
app.get("/posts/search", async (req, res) => {
    var { usernames, tags } = req.query;

    tags = tags? tags.split(',') : [];
    usernames = usernames? usernames.split(',') : [];
    let tagsMatches =  await Post.find({tags: {$in:tags}});
    res.send([...tagsMatches]);
})

app.post("/posts/create", [withAuth, upload.single("image")], async (req, res) => {
    const user = await User.findOne({_id: req.user._id});
    console.log(user)
    if (user){
        console.log(req.body)
        var username = user.username
        var user_id = user._id
        var imageUri = ""
        if (req.file){
            imageUri = req.file.path
        }
        var { title, content, tags, repost } = req.body;
        const post = new Post({user_id, username, title, content, imageUri, tags, repost });
        await post.save();
        console.log(post)
        user.posts.push(post._id);
        await user.save();
        res.send(post);
    } else {
        res.status(401).json({message: 'Invalid credentials'});
    }
    
});

app.post("/posts/like", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $addToSet : { "profile.likes" : req.body.post}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})
app.post("/posts/unlike", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $pull : { "profile.likes" : req.body.post}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post("/users/follow", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $addToSet : { "profile.following" : req.body.user}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post("/users/unfollow", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $pull : { "profile.following" : req.body.user}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post("/profiles/create", withAuth, async (req, res) => {
    const user = await User.findOne({username: req.user.username});
    if (user){
        var username = req.user.username
        var { bio, tags, birthdate, likes, followers, following } = req.body;
        const profile = new Profile({ username, bio, birthdate, likes, followers, following, tags});
        await profile.save();
        user.profile = (profile._id);
        await user.save();
        res.send(profile);
    }
}
)

app.get('/posts/global', async (req, res) => {
    try {
        const posts = await Post.find().sort({date: -1})
        res.json(posts)
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/posts/feed', withAuth, async (req, res) => {
    try {
        if (req.user) {
            const user = await User.findById(req.user._id)
            console.log(user)
            const following = user.profile.following
            const posts = await Post.find({
            user_id: {$in : following}
        }).sort({date: -1})
        res.json(posts)
        }
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

app.get('/posts/tagsfeed', withAuth, async (req, res) => {
    try {
        if (req.user) {
            const user = await User.findById(req.user._id)
            console.log(user)
            const following = user.profile.followedTags
            const posts = await Post.find({
            tags: {$in : following}
        }).sort({date: -1})
        res.json(posts)
        }
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

app.get('/tags/:tag', async (req, res) => {
    try {
        const posts = await Post.find({tags: req.params.tag }).sort({date: -1})
        res.json(posts)
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

app.post("/tags/follow", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $addToSet : { "profile.followedTags" : req.body.tag}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.post("/tags/unfollow", withAuth, async (req, res) => {
    try {
        if (req.user) {
            const result = await User.findByIdAndUpdate(req.user._id, { 
                $pull : { "profile.followedTags" : req.body.tag}
            })
            console.log(result);
            res.json("success")
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.get("/posts/:id", async (req, res) => {
    try {
        const result = await Post.findById(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

app.delete("/posts/:id", async (req, res) => {
    try {
        const result = await Post.findByIdAndDelete(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

const port = process.env.PORT || 3000;

app.listen(port, () => console.log("Server started"));