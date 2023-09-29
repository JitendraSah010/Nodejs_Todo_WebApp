const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const mongoDbSession = require('connect-mongodb-session')(session);

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}))
app.use(express.static('public'));
mongoose.connect('mongodb+srv://jitendrasah:jitendra1234@cluster0.rdgu0z9.mongodb.net/?retryWrites=true&w=majority').then(  ()=>{
    console.log('MongoDB is connected');
})
// ---------------------------- Setup Session-------------------------------
// store session on database
const StoreSession = new mongoDbSession({
    uri: 'mongodb+srv://jitendrasah:jitendra1234@cluster0.rdgu0z9.mongodb.net/?retryWrites=true&w=majority',
    collection: 'sessions'
})

app.use(session({
    secret: 'This is a secret',      //secret ensure that our cookie and session are encrypted
    resave: false,                   // everytime some changes is done then, i don't want to save it
    saveUninitialized: false,        // uninitialised session isnot saved
    store: StoreSession,
}))

// isAuth Middleware =>This will allow to open todo page only when logged in else don't allow to open that page directly
const isAuth = (req,res,next)=>{
    if(req.session.isAuth == true){
        next()
    }
    else{
        res.redirect('/');
    }
}

// Admin Middleware
const isAdmin = (req, res, next)=>{
    if(req.session.loginUser.role == 1 && req.session.isAuth == true){
        next()
    }
    else{
        res.redirect('/')
    }
}

// ---------------------------------- login Task Schema -----------------------------------
const taskSchema = new mongoose.Schema( { 
    task:String, 
    dueDate:Date,
    userEmail: String
 } )
 const Task = mongoose.model('TodoData', taskSchema);       //task model

// --------------------------Send data on mongoDB----------------------
app.post('/add-task', (req,res)=>{
    const Task = mongoose.model('TodoData', taskSchema);
    const data = new Task({ 
        task:req.body.task,
        dueDate:req.body.dueDate,
        userEmail:req.session.loginUser.email,
    })
    data.save();
    res.redirect('/todo');
})
app.get('/add-task', (req,res)=>{
    res.render('addTask')
})
// ---------------------------retrive data------------------------------------
app.get('/todo', isAuth, async(req,res)=>{              //this "isAuth" will protect our todo page from open without login
    const data = await Task.find({userEmail: req.session.loginUser.email}).sort({dueDate:'asc'});
    let NewData = data.map( (task)=>{
        let date = new Date(task.dueDate)
        FormatDueDate = date.toLocaleDateString('en', {weekday: 'long', month: 'long', day: 'numeric'} ) + " (" + date.toLocaleTimeString('en', {hour :"2-digit", minute:"2-digit"}) + ")" ;
        return {task:task.task, dueDate:FormatDueDate};
    } )
    const DispName = req.session.loginUser.name;
    res.render('home', {task:NewData, name:DispName});
})
// ---------------------------- start login functionality -------------------------------
app.get('/', (req,res)=>{
    //req.session.test ='ToDo session and cookie'   //putting value into the session
    //console.log(req.session)
    res.render('login')
})

app.post('/login', async (req,res)=>{
    const { email, password } = req.body;
    const loginUser = await RegisterUser.findOne( {email} );
    // check user exists and password match
    if(!loginUser){
        return res.status(406).json( {message: "User does not exist."} )   //Status code is used to display message
    }
    const isPasswordValid = await bcrypt.compare( password, loginUser.password )
                                                      
    if(isPasswordValid){
        req.session.isAuth = true;                             
        //req.session.name = loginUser.name;
        req.session.loginUser = loginUser;                            
        console.log(req.session.loginUser)
        if(loginUser.role ==0){
        res.redirect('/todo');
        }
        else{
        res.redirect('/adminDashboard');
        }
    }
    else{
        return res.status(406).json( {message: "Password is wrong! Write correct password"} ) 
    }
} )
// ----------------------------End login functionality -------------------------------

// ----------------------------Start Registration functionality -------------------------------------
// registration schema
const RegistrationSchema = new mongoose.Schema({
    name: {type: String, required:true},            
    email: {type:String, required:true, unique:true},
    password: {type:String, required:true, unique:true},
    role: {type: Number, default:0 }
})
// defining the registered-user model
const RegisterUser = mongoose.model('RegisteredUser', RegistrationSchema);

app.get('/register-user', (req,res)=>{
    res.render('register')
})

app.post('/register-user', async(req,res)=>{
    const {name, email, password} = req.body;
    // Check if user exists
    const existingUser = await RegisterUser.findOne( {email} );
    if(existingUser){
        return res.status(406).json( {message: "User already exist"} )   //Status code is used to display message
    }
    // create new user
    const newUser = new RegisterUser( {
        name:name,
        email:email,
        password: await bcrypt.hash(password,10)     //encrypt the password
    });
    await newUser.save();
    res.redirect('/')
})
// ---------------------------- End Registration functionality -------------------------------------

// -----------------------------Admin Dashboard functionality--------------------------
// finding admin
app.get('/adminDashboard', isAdmin, async(req,res)=>{
    const userDetails = await RegisterUser.find({role:0});

    res.render('adminDashboard', {userDetails: userDetails});
})
// fetch user detail and tasks on admin page
app.post('/user-details', isAdmin, async(req,res)=>{
    const usersDetailOnAdmin = await RegisterUser.findOne({email: req.body.email});
    const taskDetailsOnAdmin = await Task.find({userEmail: req.body.email});
    res.render('userDetails', {usersDetailOnAdmin:usersDetailOnAdmin, taskDetailsOnAdmin:taskDetailsOnAdmin});
})
// delete user and it's tasks by admin
app.post('/delete-user', async(req,res)=>{
    const usersDetailOnAdmin = await RegisterUser.deleteOne({email: req.body.email});
    const taskDetailsOnAdmin = await Task.deleteMany({userEmail: req.body.email});
    res.redirect('/adminDashboard');
})

// delete task
app.post('/delete-task', async(req,res)=>{              //this "isAuth" will protect our todo page from open without login
    const Task = mongoose.model('TodoData', taskSchema);
    await Task.deleteOne(Task.task);
    res.redirect('/todo')
})


app.get('/', (req,res)=>{
    res.render('home');
} )
app.post('/logout', (req,res)=>{
    req.session.destroy();
    res.redirect('/');
})
app.get('*', (req,res)=>{
    res.render('notFound');
})


app.listen(3002, ()=>{
    console.log("server is running on port 3002");
})