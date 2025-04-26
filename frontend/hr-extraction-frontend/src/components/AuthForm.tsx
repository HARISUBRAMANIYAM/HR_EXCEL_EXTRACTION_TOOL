// // src/components/AuthForm.tsx

// import React, { useState } from "react";
// import { useAuth } from "../context/AuthContext";
// import { Role } from "../types";

// const AuthForm: React.FC = () => {
//   const [isLogin, setIsLogin] = useState(true);
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [email, setEmail] = useState("");
//   const [fullName, setFullName] = useState("");
//   const [role, setRole] = useState<Role>(Role.USER);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);
//   const { login } = useAuth();
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError("");

//     try {
//       if (isLogin) {
//         // Login process
//         const formData = new URLSearchParams();
//         formData.append("username", username);
//         formData.append("password", password);

//         const response = await fetch("http://localhost:8000/login", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/x-www-form-urlencoded",
//           },
//           body: formData,
//         });

//         if (!response.ok) {
//           const errorData = await response.json();
//           throw new Error(errorData.detail || "Login failed");
//         }

//         const data = await response.json();
//         login(data);
//       } else {
//         // Registration process
//         const response = await fetch("http://localhost:8000/register", {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             username,
//             password,
//             email,
//             full_name: fullName,
//             role,
//           }),
//         });

//         if (!response.ok) {
//           const errorData = await response.json();
//           throw new Error(errorData.detail || "Registration failed");
//         }

//         // Switch to login form after successful registration
//         setIsLogin(true);
//         setError("Registration successful! Please login.");
//       }
//     } catch (err) {
//       if (err instanceof Error) {
//         setError(err.message);
//       } else {
//         setError("An unexpected error occurred");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="auth-form-container">
//       <h2>{isLogin ? "Login" : "Register"}</h2>
//       {error && <div className="error-message">{error}</div>}
//       <form onSubmit={handleSubmit} className="auth-form">
//         <div className="form-group">
//           <label htmlFor="username">Username</label>
//           <input
//             id="username"
//             type="text"
//             value={username}
//             onChange={(e) => setUsername(e.target.value)}
//             required
//             minLength={4}
//             maxLength={50}
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="password">Password</label>
//           <input
//             id="password"
//             type="password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//             minLength={8}
//             maxLength={100}
//           />
//         </div>

//         {!isLogin && (
//           <>
//             <div className="form-group">
//               <label htmlFor="email">Email</label>
//               <input
//                 id="email"
//                 type="email"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 required
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="fullName">Full Name</label>
//               <input
//                 id="fullName"
//                 type="text"
//                 value={fullName}
//                 onChange={(e) => setFullName(e.target.value)}
//                 required
//               />
//             </div>

//             <div className="form-group">
//               <label htmlFor="role">Role</label>
//               <select
//                 id="role"
//                 value={role}
//                 onChange={(e) => setRole(e.target.value as Role)}
//               >
//                 <option value={Role.USER}>User</option>
//                 <option value={Role.HR}>HR</option>
//                 <option value={Role.ADMIN}>Admin</option>
//               </select>
//             </div>
//           </>
//         )}

//         <button type="submit" className="submit-button" disabled={loading}>
//           {loading ? "Loading..." : isLogin ? "Login" : "Register"}
//         </button>

//         <p className="auth-toggle">
//           {isLogin ? "Don't have an account? " : "Already have an account? "}
//           <button
//             type="button"
//             className="toggle-button"
//             onClick={() => setIsLogin(!isLogin)}
//           >
//             {isLogin ? "Register" : "Login"}
//           </button>
//         </p>
//       </form>
//     </div>
//   );
// };

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Role } from "../types";

const AuthForm: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    fullName: "",
    role: Role.USER
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    console.log("Form submission event:",e);

    try {
      if (isLogin) {
        // Login process
        console.log("Attempting login......");
        const formDataEncoded = new URLSearchParams();
        formDataEncoded.append('username', formData.username);
        formDataEncoded.append('password', formData.password);

        const response = await api.post("/login", formDataEncoded, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        console.log("Login Response:",response);
        if (response.data.access_token && response.data.refresh_token) {
          console.log("Login successful, attempting navigation...");
          login(response.data);
          try{
            setTimeout(()=>{
              navigate("/dashboard", { replace: true });
              console.log("Naivgatin Called")
            },100);
          }catch(navError){
            console.error("Navigation failed...:",navError);
            window.location.href ="/dashboard";
          }
          
          
        } else {
          throw new Error("Invalid token response");
        }
      } else {
        // Registration process
        const registrationResponse = await api.post("/register", {
          username: formData.username,
          password: formData.password,
          email: formData.email,
          full_name: formData.fullName,
          role: formData.role
        });
        
        if (registrationResponse.status === 200 || registrationResponse.status === 201) {
          // Auto-login after registration
          const formDataEncoded = new URLSearchParams();
          formDataEncoded.append('username', formData.username);
          formDataEncoded.append('password', formData.password);
          
          const loginResponse = await api.post("/login", formDataEncoded, {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          
          if (loginResponse.data.access_token && loginResponse.data.refresh_token) {
            login(loginResponse.data);
            navigate("/dashboard", { replace: true });
          } else {
            throw new Error("Registration successful but login failed");
          }
        } else {
          throw new Error("Registration failed");
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        err.response?.data?.message || 
        err.message || 
        "An error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = (e: React.MouseEvent<HTMLButtonElement>) => {
    setIsLogin(!isLogin);
    // Reset form data and errors when switching modes
    setFormData({
      username: "",
      password: "",
      email: "",
      fullName: "",
      role: Role.USER
    });
    setError("");
  };

  return (
    <div className="auth-form-container">
      <h2>{isLogin ? "Login" : "Register"}</h2>
      {error && (
        <div className="error-message">
          {error.split("\n").map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={formData.username}
            onChange={handleChange}
            required
            minLength={4}
            maxLength={50}
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={8}
            maxLength={100}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </div>

        {!isLogin && (
          <>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value={Role.USER}>User</option>
                <option value={Role.HR}>HR</option>
                <option value={Role.ADMIN}>Admin</option>
              </select>
            </div>
          </>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={
            loading ||
            (isLogin
              ? !formData.username || !formData.password
              : !formData.username || !formData.password || !formData.email || !formData.fullName)
          }
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              {isLogin ? "Logging in..." : "Registering..."}
            </>
          ) : isLogin ? (
            "Login"
          ) : (
            "Register"
          )}
        </button>

        <p className="auth-toggle">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="toggle-button"
            onClick={toggleAuthMode}
            disabled={loading}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </form>
    </div>
  );
};

export default AuthForm;