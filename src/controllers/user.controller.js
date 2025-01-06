import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import { User } from "../models/user.models.js";
import {Submission} from "../models/submission.models.js"
import mongoose from "mongoose";
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import jwt  from "jsonwebtoken";


const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken 

        await user.save({validateBeforeSave : false})

        return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500 , "someThing went wrong")
    }
}

const registerUser = asyncHandler( async (req , res) => {

    // get details from frontend
    // validation : not empty
    // check if user already exists or not : username and email
    // check for images , avatar
    // create user , entry in db
    // remove password and refresh token from response
    // check for user creation 
    // return user

    const {userName , email , fullName , password , gender} = req.body

    if([userName , email , fullName , password].some((field) => field?.trim() === "")){
        throw new ApiError(400 , "all fields are required")
    }

    console.log(userName , email , fullName , password);

    const existeduser = await User.findOne({
        $or : [{userName} , {email} ]
    })

    if(existeduser) throw new ApiError(409 , "User already exists");

    const boyProfilePic = `https://avatar.iran.liara.run/public/boy?username=${userName}`;
	const girlProfilePic = `https://avatar.iran.liara.run/public/girl?username=${userName}`;

    const user = await User.create({
        fullName : fullName ,
        email : email,
        avatar :  gender == "male" ? boyProfilePic : girlProfilePic ,
        gender ,
        password : password,
        userName : userName.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -OTP"
    )

    if(!createdUser) throw new ApiError(500 , "something went wrong while registering the user");

    return res.status(201).json(
        new ApiResponse(200 , createdUser , "User registered successfully")
    );
})

const loginUser = asyncHandler(async (req, res) => {
    // get details from frontend
    // email and password
    // find does user exist
    //password check
    //access and refresh token
    // send cookies

    const { email, password } = req.body;

    if (!(email && password)) throw new ApiError(400, "Email and password are required");

    const userDetails = await User.findOne({ email });

    if (!userDetails) throw new ApiError(404, "User does not exist");

    const isPasswordValid = await userDetails.isPasswordCorrect(password);

    if (!isPasswordValid) throw new ApiError(401, "Password is incorrect");

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(userDetails._id);

    const loggedInUser = await User.findById(userDetails._id).select("-password -refreshToken -OTP");

    const accessTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };
    const refreshTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };

    res.cookie("refreshToken", refreshToken, refreshTokenOptions);
    res.cookie("accessToken", accessToken, accessTokenOptions);

    return res.status(200).json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully..."));
});

const logoutUser = asyncHandler( async(req , res) => {
    const id = req.user._id
    User.findByIdAndUpdate(id , {$set : { refreshToken : undefined }} , {new : true})

    const options = {httpOnly : true , secure : true}

    return res.status(200).clearCookie("accessToken" , options).clearCookie("refreshToken" , options).
    json(new ApiResponse(200 , {} , "user logged out"))

})

const refreshAccesstoken = asyncHandler( async(req , res) =>{
    const token = req.cookies.refreshToken || req.body.refreshToken

    try {
        if(!token) throw new ApiError(401 , "unauthorized user");
    
        const decodedtoken =  jwt.verify(token , process.env.REFRESH_TOKEN_SECRET);
    
        if(!decodedtoken) throw new ApiError(401 , "unauthorized user");
    
        const user = await User.findById(decodedtoken._id);
    
        if(!user) throw new ApiError(401 , "invalid refresh token");
    
        if(user.refreshToken != token) throw new ApiError(401 , "refresh token is expired");
    
        const options = { httpOnly: true, secure: true, sameSite: 'None' };
    
        const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res.status(200).cookie("refreshToken" , refreshToken , options).cookie("accessToken" , accessToken , options)
        .json(new ApiResponse(200 , {accessToken , refreshToken} , "access token refreshed"))

    } catch (error) {
        throw new ApiError(500 , "something went wrong");
    }
})

const getUserDashboard = asyncHandler(async (req , res) => {
    const {slug} = req.params ;

    const response = await User.aggregate([
        {$match : {_id : new mongoose.Types.ObjectId(slug)}},
        {$lookup : {
            from : "submissions" ,
            localField : "_id",
            foreignField : "userId",
            as : "solved",
            pipeline : [{
                $lookup:{localField : "questionId",
                    foreignField : "_id",
                    from : "questions" ,
                    as : "question",
                    pipeline : [{
                        $project : {
                            title : 1,
                            difficulty : 1
                        }
                    }]
                }
            },{
                $project : {
                    updatedAt : 1,
                    question : 1
                }
            },{$addFields : {question : {$first : "$question"}}}]
        }},
        {$lookup : {
            from : "submissions" ,
            localField : "_id",
            foreignField : "userId",
            as : "submissions",
            pipeline : [{
                $project : {
                    title : 1,
                    difficulty : 1,
                    submissions : 1,
                    updatedAt : 1,
                }
            }]
        }},
        {$project : {
            _id : 0 ,
            OTP : 0 ,
            refreshToken : 0,
            password : 0,
            googleId : 0,
            githubId : 0
        }}
    ])

    if(! response) throw new ApiError(500 , "error while fetching user details")

    return res.status(200).json(response[0])
})

const getStarted = asyncHandler(async (req, res) => {
    const { provider, token, code, email, password, fullName } = req.body;

    if (!provider) {
        throw new ApiError(400, 'Provider is required');
    }

    let userEmail, userFullName, avatar, userName, googleId, githubId;

    // Handle OAuth providers: Google or GitHub
    if (provider === 'google') {
        if (!token) {
            throw new ApiError(400, 'Token is required for Google login');
        }

        try {
            // Fetch user info from Google OAuth2 endpoint using axios
            const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!data || !data.email) {
                throw new ApiError(500, 'Failed to retrieve user data from Google');
            }

            // Extract user details
            userEmail = data.email;
            userFullName = data.name;
            avatar = data.picture;
            userName = userFullName.split(' ').join('').toLowerCase();
            googleId = data.sub; // Unique Google user ID
        } catch (error) {
            console.error('Error during Google OAuth:', error.message || error.response?.data || error);
            throw new ApiError(500, 'Failed to authenticate with Google');
        }
    } else if (provider === 'github') {
        if (!code) {
            throw new ApiError(400, 'Authorization code is required for GitHub login');
        }
        try {
            // Exchange GitHub code for an access token
            const githubTokenResponse = await axios.post(
                'https://github.com/login/oauth/access_token',
                {
                    client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
                    client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
                    code,
                },
                { headers: { Accept: 'application/json' } }
            );

            const githubAccessToken = githubTokenResponse.data.access_token;
            if(!githubAccessToken) throw new ApiError(400 , "wrong token")

            // Fetch user details from GitHub
            const githubUserResponse = await axios.get('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${githubAccessToken}` },
            });

            const githubUser = githubUserResponse.data;
            userEmail = githubUser.email || `${githubUser.login}@github.com`;
            userFullName = githubUser.name || githubUser.login;
            avatar = githubUser.avatar_url;
            userName = githubUser.login.toLowerCase();
            githubId = githubUser.id; // Unique GitHub user ID
        } catch (error) {
            throw new ApiError(500, 'Failed to authenticate with GitHub');
        }
    } else if (provider === 'normal') {
        if (!email || !password) {
            throw new ApiError(400, 'Email and password are required for normal login/signup');
        }
        userEmail = email;
        userFullName = fullName || email.split('@')[0];
        userName = userFullName.split(' ').join('').toLowerCase();
    } else {
        throw new ApiError(400, 'Unsupported provider');
    }

    // Check if user exists
    let user = await User.findOne({ email: userEmail });

    if (user) {
        // If user exists, update provider-specific IDs if applicable
        if (provider === 'google' && !user.googleId) {
            user.googleId = googleId;
        }
        if (provider === 'github' && !user.githubId) {
            user.githubId = githubId;
        }
        await user.save();
    } else {
        // If user does not exist, create a new user
        if (provider === 'normal' && !password) {
            throw new ApiError(400, 'Password is required for normal signup');
        }

        user = await User.create({
            userName,
            fullName: userFullName,
            email: userEmail,
            avatar: avatar || '',
            password: provider === 'normal' ? password : null, // Only set password for normal login
            googleId: provider === 'google' ? googleId : null,
            githubId: provider === 'github' ? githubId : null,
        });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const userResponse = await User.findById(user._id).select('-password -refreshToken -OTP -googleId -githubId');

    const accessTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };
    const refreshTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };

    res.cookie("refreshToken", refreshToken, refreshTokenOptions);
    res.cookie("accessToken", accessToken, accessTokenOptions);

    return res.status(200).json(
        new ApiResponse(
            200,
            { user: userResponse, accessToken, refreshToken },
            'User authenticated successfully'
        )
    );
});

const getUsers = asyncHandler(async (req , res) => {
    const response = await User.find().select("userName avatar fullName solved");

    return res.status(200).json({response})
});

const updateDetails = asyncHandler(async (req , res) => {
    const id = req.user?._id ;

    const {fullName , userName} = req.body

    if(!fullName || !userName) throw new ApiError(400 , "fullname and username are required");

    const response = await User.findByIdAndUpdate(id , {fullName , userName} , {new : true}).select("fullName userName");

    return res.status(200).json({response})
})

const getCurrentUser = asyncHandler(async (req , res) => {
    return res.status(200).json({ user : req.user});
})





export { registerUser , loginUser , logoutUser , refreshAccesstoken , getUserDashboard , getStarted , getUsers , updateDetails , getCurrentUser}