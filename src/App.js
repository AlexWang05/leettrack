import './App.css';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, collection, orderBy, query, addDoc, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';

const app = initializeApp({
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
});

const auth = getAuth(app);
const firestore = getFirestore(app);

function App() {
    const [user] = useAuthState(auth);

    return (
        <div className="App">
            <header className="App-header">
                <h1>LeetTrack</h1>
                {user && <SignOut />}
            </header>
            <NotificationBanner />
            <section>
                {user ? <Dashboard /> : <SignIn />}
            </section>
        </div>
    );
}

function Dashboard() {
    const [problemTitle, setProblemTitle] = useState('');
    const [difficulty, setDifficulty] = useState('Easy');
    const [description, setDescription] = useState('');
    const [activeTab, setActiveTab] = useState('today');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const problemsRef = collection(firestore, 'problems');
    const todayQuery = query(
        problemsRef,
        where('createdAt', '>=', Timestamp.fromDate(today)),
        where('createdAt', '<', Timestamp.fromDate(tomorrow)),
        orderBy('createdAt', 'desc')
    );
    const allTimeQuery = query(problemsRef, orderBy('createdAt', 'desc'));
    
    const [todayProblems] = useCollectionData(todayQuery, { idField: 'id' });
    const [allProblems] = useCollectionData(allTimeQuery, { idField: 'id' });

    const addProblem = async(e) => {
        e.preventDefault();
        try {
            await addDoc(problemsRef, {
                title: problemTitle,
                difficulty: difficulty || 'Easy',
                description,
                userId: auth.currentUser.uid,
                userName: auth.currentUser.displayName,
                userPhoto: auth.currentUser.photoURL,
                createdAt: serverTimestamp()
            });
            setProblemTitle('');
            setDescription('');
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    }

    const groupProblemsByUser = (problems) => {
        if (!problems) return new Map();
        const userMap = new Map();
        problems.forEach(problem => {
            if (!userMap.has(problem.userId)) {
                userMap.set(problem.userId, {
                    userName: problem.userName,
                    userPhoto: problem.userPhoto,
                    problems: []
                });
            }
            userMap.get(problem.userId).problems.push(problem);
        });
        return userMap;
    }

    const todayUserMap = groupProblemsByUser(todayProblems);
    const allUserMap = groupProblemsByUser(allProblems);

    const getAllUsers = () => {
        const allUsers = new Set();
        allProblems?.forEach(problem => {
            allUsers.add(problem.userId);
        });
        return Array.from(allUsers);
    }

    const allUsers = getAllUsers();
    
    const getInactiveUsers = () => {
        const inactiveUsers = [];
        allUsers.forEach(userId => {
            if (!todayUserMap.has(userId) && allUserMap.get(userId)) {
                inactiveUsers.push(allUserMap.get(userId));
            }
        });
        return inactiveUsers;
    };

    const inactiveUsers = getInactiveUsers();


    return (
        <div className="dashboard">
            <div className="stats-banner">
                <h2>Today's Progress</h2>
                <div className="stats-content">
                    <div className="stat-item">
                        <span className="stat-number">{todayProblems?.length || 0}</span>
                        <span className="stat-label">Problems Solved Today</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-number">{todayUserMap.size}</span>
                        <span className="stat-label">Active Users Today</span>
                    </div>
                </div>
            </div>

            {inactiveUsers.length > 0 && (
            <div className="shame-section">
                <h2><span>😴</span> Still Waiting For These Folks...</h2>
                <div className="inactive-users-grid">
                    {inactiveUsers.map(user => (
                        <div key={user.userName} className="inactive-user-card">
                            {user.userPhoto ? (
                                <img 
                                    src={user.userPhoto} 
                                    alt={user.userName}
                                    className="inactive-user-photo"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="inactive-user-photo-placeholder">
                                    {user.userName?.charAt(0)?.toUpperCase()}
                                </div>
                            )}
                            <span className="inactive-user-name">{user.userName}</span>
                            <span className="shame-badge">No Problems Solved Today</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

            <div className="add-problem-section">
                <h3>Add Problem Solved</h3>
                <form onSubmit={addProblem} className="problem-form">
                    <input 
                        value={problemTitle}
                        onChange={(e) => setProblemTitle(e.target.value)}
                        placeholder="Leetcode Link or title"
                        required
                    />
                    <select 
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                    >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                    </select>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Share your approach or notes..."
                        required
                    />
                    <button type="submit" className="submit-button">Share Solution</button>
                </form>
            </div>

            <div className="problems-section">
                <div className="tabs">
                    <button 
                        className={`tab ${activeTab === 'today' ? 'active' : ''}`}
                        onClick={() => setActiveTab('today')}
                    >
                        Today's Solutions
                    </button>
                    <button 
                        className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All Time
                    </button>
                </div>

                <div className="user-problems-list">
                    {allUsers.map(userId => (
                        <UserSection 
                            key={userId}
                            userData={activeTab === 'today' ? todayUserMap.get(userId) : allUserMap.get(userId)}
                            isActiveToday={todayUserMap.has(userId)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function NotificationBanner() {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="notification-banner">
            <span className="notification-icon">ℹ️</span>
            <p>This project was made in 1 hour. There's gonna be ways to break it. Try not to damage the app pls lol</p>
            <button 
                className="notification-dismiss" 
                onClick={() => setIsVisible(false)}
                aria-label="Dismiss notification"
            >
                ×
            </button>
        </div>
    );
}


function UserSection({ userData, isActiveToday }) {
    const [imageError, setImageError] = useState(false);

    if (!userData) return null;
    const { userName, userPhoto, problems } = userData;

    const handleImageError = () => {
        setImageError(true);
    };

    return (
        <div className={`user-section ${isActiveToday ? 'active-today' : 'inactive-today'}`}>
            <div className="user-header">
                <div className="user-info">
                    {userPhoto && !imageError ? (
                        <img 
                            src={userPhoto} 
                            alt={userName}
                            className="user-photo"
                            onError={handleImageError}
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="user-photo-placeholder">
                            {userName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                    )}
                    <span className="user-name">{userName}</span>
                </div>
                <div className="user-status">
                    {isActiveToday ? (
                        <span className="status-badge active">Active Today</span>
                    ) : (
                        <span className="status-badge inactive">Inactive Today</span>
                    )}
                </div>
            </div>
            <div className="user-problems">
                {problems.map(problem => (
                    <ProblemItem key={problem.id} problem={problem} showUserInfo={false} />
                ))}
            </div>
        </div>
    );
}

function ProblemItem({ problem, showUserInfo = true }) {
    // Move useState to the top level
    const [imageError, setImageError] = useState(false);
    
    const { title, difficulty = 'Easy', description, userName, userPhoto, createdAt } = problem;
    const difficultyClass = difficulty ? difficulty.toLowerCase() : 'easy';
    const problemDate = createdAt?.toDate().toLocaleTimeString();

    const handleImageError = () => {
        setImageError(true);
    };

    return (
        <div className={`problem-item difficulty-${difficultyClass}`}>
            {showUserInfo && (
                <div className="problem-header">
                    <div className="user-info">
                        {userPhoto && !imageError ? (
                            <img 
                                src={userPhoto} 
                                alt={userName}
                                className="user-photo"
                                onError={handleImageError}
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="user-photo-placeholder">
                                {userName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                        )}
                        <span className="user-name">{userName}</span>
                    </div>
                    <span className="timestamp">{problemDate}</span>
                </div>
            )}
            <div className="problem-content">
                <div className="problem-title">
                    <strong>{title}</strong>
                    <span className={`difficulty-badge ${difficultyClass}`}>
                        {difficulty || 'Easy'}
                    </span>
                </div>
                <p className="problem-description">{description}</p>
            </div>
        </div>
    );
}

function SignIn() {
    const signInWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider);
    }

    return (
        <div className="sign-in">
            <h2>Welcome to LeetTrack</h2>
            <p>Sign in to track your LeetCode progress</p>
            <button className="sign-in-button" onClick={signInWithGoogle}>
                Sign in with Google
            </button>
        </div>
    );
}

function SignOut() {
    return auth.currentUser && (
        <button className="sign-out-button" onClick={() => signOut(auth)}>
            Sign Out
        </button>
    );
}

export default App;