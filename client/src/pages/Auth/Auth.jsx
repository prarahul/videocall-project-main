import { useState } from 'react';
import { FaUser, FaEnvelope, FaLock, FaGoogle, FaApple, FaFacebookF, FaMicrosoft } from 'react-icons/fa';
import toast, { Toaster } from 'react-hot-toast';
import apiClient from '../../apiClient';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../context/UserContextApi';



const AuthForm = ({ type }) => {
      const {updateUser } = useUser();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullname: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        gender: 'male',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (type === 'signup' && formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match!');
            return;
        }
        setLoading(true);
        try {
            const endpoint = type === 'signup' ? '/auth/signup' : '/auth/login';
            const response = await apiClient.post(endpoint, formData);
            toast.success(response.data.message || 'Success!');
            if(type === 'signup'){
                navigate('/login')
            }
            if (type === 'login') {
                // Extract only the user data, not the full response
                const userData = {
                    _id: response.data._id,
                    fullname: response.data.fullname,
                    username: response.data.username,
                    email: response.data.email,
                    profilepic: response.data.profilepic
                };
                
                updateUser(userData);
                
                // Save token in cookies
                const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
                const expires = "expires=" + date.toUTCString();
                document.cookie = `jwt=${response.data.token}; path=/; ${expires}`;
                navigate('/')
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Something went wrong!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-center">
            <div className="card w-full max-w-sm">
                <h2 className="text-2xl font-bold text-center mb-4">{type === 'signup' ? 'Create your account' : 'Sign in to Connect Pro'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {type === 'signup' && (
                        <>
                            <div className="flex items-center bg-gray-100 p-2 rounded-md">
                                <FaUser className="text-gray-500 mr-2" />
                                <input
                                    type="text"
                                    name="fullname"
                                    placeholder="Full Name"
                                    className="w-full bg-transparent focus:outline-none input"
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="flex items-center bg-gray-100 p-2 rounded-md">
                                <FaUser className="text-gray-500 mr-2" />
                                <input
                                    type="text"
                                    name="username"
                                    placeholder="Username"
                                    className="w-full bg-transparent focus:outline-none input"
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </>
                    )}
                    <div className="flex items-center bg-gray-100 p-2 rounded-md">
                        <FaEnvelope className="text-gray-500 mr-2" />
                        <input
                            type="email"
                            name="email"
                            placeholder="Email or phone number"
                            className="w-full bg-transparent focus:outline-none input"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="flex items-center bg-gray-100 p-2 rounded-md">
                        <FaLock className="text-gray-500 mr-2" />
                        <input
                            type="password"
                            name="password"
                            placeholder="Password"
                            className="w-full bg-transparent focus:outline-none input"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    {type === 'signup' && (
                        <div className="flex items-center bg-gray-100 p-2 rounded-md">
                            <FaLock className="text-gray-500 mr-2" />
                            <input
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirm Password"
                                className="w-full bg-transparent focus:outline-none input"
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : type === 'signup' ? 'Create account' : 'Next'}
                    </button>
                </form>

                <div className="my-4 text-center text-sm text-gray-500">Or sign in with</div>
                <div className="social-row mb-4">
                    <button className="social-btn" title="SSO">
                        <FaUser className="text-gray-700" />
                    </button>
                    <button className="social-btn" title="Google">
                        <FaGoogle className="text-red-600" />
                    </button>
                    <button className="social-btn" title="Apple">
                        <FaApple className="text-black" />
                    </button>
                    <button className="social-btn" title="Microsoft">
                        <FaMicrosoft className="text-blue-600" />
                    </button>
                    <button className="social-btn" title="Facebook">
                        <FaFacebookF className="text-blue-700" />
                    </button>
                </div>

                <p className="text-center text-sm text-gray-500">
                    {type === 'signup' ? (
                        <>Already have an account? <Link to="/login" style={{color:'var(--color-primary)'}}>Login</Link></>
                    ) : (
                        <>Don't have an account? <Link to="/signup" style={{color:'var(--color-primary)'}}>Register</Link></>
                    )}
                </p>
            </div>
            <Toaster position="top-center" />
        </div>
    );
};

export default AuthForm;