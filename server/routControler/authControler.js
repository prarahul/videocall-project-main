import User from "../schema/userSchema.js"
import bcrypt from "bcryptjs"
import jwtToken from "../utils/jwtToken.js";
import { addUser, findUserByEmail, findUserByUsername } from "../utils/tempStorage.js";

export const SignUp = async (req, res) => {
    try {
        const { fullname, username, email, password, gender, profilepic } = req.body
        
        // Check if user exists in temporary storage
        const existingUser = findUserByUsername(username);
        if (existingUser) return res.status(400).send({ success: false, message: "Username Already Exists" })
        
        const existingEmail = findUserByEmail(email);
        if (existingEmail) return res.status(400).send({ success: false, message: "Email Already Exists" })
        
        const hashPassword = bcrypt.hashSync(password, 10)
        const boyProfilePic = profilepic || `https://ui-avatars.com/api/?name=${username}&background=3b82f6&color=fff&size=128`
        const girlProfilePic = profilepic || `https://ui-avatars.com/api/?name=${username}&background=e91e63&color=fff&size=128`

        const newUser = {
            _id: Date.now().toString(), // Simple ID generation
            fullname,
            username,
            email,
            password: hashPassword,
            gender,
            profilepic: gender === "male" ? boyProfilePic : girlProfilePic
        }
        
        // Store in shared temporary storage
        addUser(newUser);
        
        // Generate JWT token
        const token = jwtToken(newUser._id, res);
        
        res.status(201).send({
            _id: newUser._id,
            fullname: newUser.fullname,
            username: newUser.username,
            profilepic: newUser.profilepic,
            email: newUser.email,
            message: "User registered successfully",
            token
        })

    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message || error
        })
        console.log(error);
    }
}



export const Login = async (req, res) => {
    try {
        const { email, password } = req.body
        
        // Find user in shared temporary storage
        const user = findUserByEmail(email);
        if (!user) return res.status(400).send({ success: false, message: "Email doesn't exist. Please register first." })
        
        const comparePassword = bcrypt.compareSync(password, user.password || "")
        if (!comparePassword) return res.status(400).send({ success: false, message: "Invalid email or password" })
        
        const token = jwtToken(user._id, res);
        console.log("Login successful for:", user.email);

        res.status(200).send({
            _id: user._id,
            fullname: user.fullname,
            username: user.username,
            profilepic: user.profilepic,
            email: user.email,
            message: "Successfully logged in",
            token
        })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error.message || error
        })
        console.log(error);
    }
}

export const LogOut = async (req, res) => {
    try {
        res.clearCookie('jwt', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        });
        res.status(200).send({ message: "User LogOut" })
    } catch (error) {
        res.status(500).send({
            success: false,
            message: error
        })
        console.log(error);
    }
}