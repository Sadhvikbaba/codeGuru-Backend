import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import asyncHandler from '../middleware/asyncHandler';
import { User } from '../models/userModel';
import { ApiError, ApiResponse } from '../utils/ApiResponse';
import jwt from 'jsonwebtoken';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    });
    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    });
    return { accessToken, refreshToken };
};

// Unified login/signup function
const handleAuth = asyncHandler(async (req, res) => {
    const { provider, token, code, email, password, fullName } = req.body;

    if (!provider) {
        throw new ApiError(400, 'Provider is required');
    }

    let userEmail, userFullName, avatar, userName;

    // OAuth providers: Google or GitHub
    if (provider === 'google') {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        userEmail = payload.email;
        userFullName = payload.name;
        avatar = payload.picture;
        userName = userFullName.split(' ').join('').toLowerCase();
    } else if (provider === 'github') {
        const githubTokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            { headers: { Accept: 'application/json' } }
        );
        const githubAccessToken = githubTokenResponse.data.access_token;

        const githubUserResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${githubAccessToken}` },
        });
        const githubUser = githubUserResponse.data;
        userEmail = githubUser.email || `${githubUser.login}@github.com`;
        userFullName = githubUser.name || githubUser.login;
        avatar = githubUser.avatar_url;
        userName = githubUser.login;
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
        // If user exists, it's a login
        if (provider === 'normal' && !(await user.matchPassword(password))) {
            throw new ApiError(401, 'Invalid email or password');
        }
    } else {
        // If user does not exist, create a new user (signup)
        if (provider === 'normal') {
            // Ensure password is provided for normal signup
            if (!password) {
                throw new ApiError(400, 'Password is required for normal signup');
            }
        }

        user = await User.create({
            userName,
            fullName: userFullName,
            email: userEmail,
            avatar: avatar || '',
            gender: '', // Optional, or prompt the user to fill this later
            password: provider === 'normal' ? password : '', // Only set password for normal login
        });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Exclude sensitive fields from the response
    const userResponse = await User.findById(user._id).select('-password -refreshToken -OTP');

    // Set cookies
    const accessTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };
    const refreshTokenOptions = { httpOnly: true, secure: true, sameSite: 'None' };

    res.cookie('refreshToken', refreshToken, refreshTokenOptions);
    res.cookie('accessToken', accessToken, accessTokenOptions);

    // Respond with the user data and tokens
    return res.status(200).json(new ApiResponse(200, { user: userResponse, accessToken, refreshToken }, 'User authenticated successfully'));
});

export { handleAuth };
