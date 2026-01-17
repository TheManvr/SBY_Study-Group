const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

// ✅ 1. ตั้งค่าให้รับรูปภาพขนาดใหญ่ได้ (50MB)
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// ==========================================
// 📂 Database Helper Functions
// ==========================================
const DB_FILE = 'database.json';
const STUDY_POSTS_FILE = 'study_posts.json';
const CHAT_FILE = 'chat.json'; // Global Chat
const PRIVATE_CHAT_FILE = 'private_chats.json'; // Private Chat
const NOTIFICATIONS_FILE = 'notifications.json';
const REGISTRATIONS_FILE = 'registrations.json'; 
const FOLLOWS_FILE = 'follows.json'; 

// ✅ ฟังก์ชันอ่านไฟล์ (Helper)
function readJsonFile(filename) {
    const filePath = path.resolve(__dirname, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        if (!data) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { 
        console.log(`⚠️ Error reading ${filename}: ${e.message}`);
        return []; 
    }
}

// ✅ ฟังก์ชันบันทึกไฟล์ (Helper)
function saveJsonFile(filename, data) {
    const filePath = path.resolve(__dirname, filename);
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`❌ Error saving ${filename}: ${e.message}`);
    }
}

// ✅ ฟังก์ชันค้นหา User
function findUserById(userId) {
    const users = readJsonFile(DB_FILE);
    if (!userId) return null;
    let found = users.find(u => String(u.id) === String(userId));
    if (!found) {
        found = users.find(u => u.userId === userId);
    }
    return found;
}

// ==========================================
// 👤 API: User & Auth
// ==========================================

app.post('/api/register-user', (req, res) => {
    try {
        const { username, password, email, role } = req.body;
        let users = readJsonFile(DB_FILE);

        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: "อีเมลนี้ถูกใช้งานแล้ว" });
        }

        const newUser = {
            id: Date.now().toString(),
            userId: username,
            name: username,
            password: password,
            email: email,
            role: role || 'student',
            bio: "ยังไม่มีข้อมูลแนะนำตัว...",
            avatar: "https://ui-avatars.com/api/?name=" + username + "&background=random"
        };

        users.push(newUser);
        saveJsonFile(DB_FILE, users);
        console.log(`✅ User Registered: ${username}`);
        res.json({ success: true, message: "สมัครสมาชิกสำเร็จ" });

    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readJsonFile(DB_FILE);

    const foundUser = users.find(u => 
        (u.email === email || u.userId === email || u.name === email) && u.password === password
    );

    if (foundUser) {
        res.json({ success: true, user: foundUser });
    } else {
        res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านผิด" });
    }
});

app.get('/api/users', (req, res) => {
    const users = readJsonFile(DB_FILE);
    const publicUsers = users.map(u => ({
        id: u.id, name: u.name, role: u.role, bio: u.bio, avatar: u.avatar
    }));
    res.json(publicUsers);
});

app.get('/api/users/:userId', (req, res) => {
    const user = findUserById(req.params.userId);
    if (user) res.json(user);
    else res.status(404).json({ message: "ไม่พบข้อมูล" });
});

app.put('/api/users/:userId', (req, res) => {
    const { userId } = req.params;
    const { name, bio, role, avatar } = req.body;
    let users = readJsonFile(DB_FILE);
    
    const index = users.findIndex(u => String(u.id) === String(userId) || u.userId === userId);

    if (index !== -1) {
        users[index].name = name;
        users[index].bio = bio;
        users[index].role = role;
        if (avatar && avatar.length > 50) users[index].avatar = avatar;
        
        saveJsonFile(DB_FILE, users);
        res.json({ message: "อัปเดตสำเร็จ", user: users[index] });
    } else {
        res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }
});

// ==========================================
// 🔔 API: Notifications
// ==========================================
app.get('/api/notifications', (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json([]);
    const notifications = readJsonFile(NOTIFICATIONS_FILE);
    
    const myNotis = notifications
        .filter(n => String(n.recipientId) === String(userId))
        .reverse();
        
    res.json(myNotis);
});

app.post('/api/notifications/mark-read', (req, res) => {
    const { userId } = req.body;
    let notifications = readJsonFile(NOTIFICATIONS_FILE);
    let updated = false;

    notifications.forEach(n => {
        if (String(n.recipientId) === String(userId) && !n.read) {
            n.read = true;
            updated = true;
        }
    });

    if (updated) saveJsonFile(NOTIFICATIONS_FILE, notifications);
    res.json({ success: true });
});

// ==========================================
// ❤️ API: Follow System
// ==========================================
app.get('/api/follows', (req, res) => {
    const { userId } = req.query;
    const follows = readJsonFile(FOLLOWS_FILE);
    const following = follows.filter(f => String(f.followerId) === String(userId));
    const followers = follows.filter(f => String(f.followingId) === String(userId));
    res.json({ following, followers });
});

app.get('/api/users/:userId/follow-list', (req, res) => {
    const { userId } = req.params;
    const { type } = req.query; 
    
    const follows = readJsonFile(FOLLOWS_FILE);
    const users = readJsonFile(DB_FILE);

    let targetIds = [];

    if (type === 'following') {
        targetIds = follows
            .filter(f => String(f.followerId) === String(userId))
            .map(f => f.followingId);
    } else if (type === 'followers') {
        targetIds = follows
            .filter(f => String(f.followingId) === String(userId))
            .map(f => f.followerId);
    }

    const result = targetIds.map(id => {
        const u = users.find(user => String(user.id) === String(id));
        if (u) {
            return {
                id: u.id, name: u.name, avatar: u.avatar, role: u.role
            };
        }
        return null;
    }).filter(item => item !== null);

    res.json(result);
});

app.post('/api/toggle-follow', (req, res) => {
    const { followerId, followingId } = req.body;
    let follows = readJsonFile(FOLLOWS_FILE);

    const index = follows.findIndex(f => 
        String(f.followerId) === String(followerId) && 
        String(f.followingId) === String(followingId)
    );

    let isFollowing = false;
    let isFriend = false; 

    if (index !== -1) {
        follows.splice(index, 1); 
    } else {
        follows.push({ 
            followerId, followingId, timestamp: new Date().toISOString() 
        });
        isFollowing = true;
        createFollowNotification(followerId, followingId);
    }

    saveJsonFile(FOLLOWS_FILE, follows);

    const followBack = follows.find(f => 
        String(f.followerId) === String(followingId) && 
        String(f.followingId) === String(followerId)
    );
    
    if (isFollowing && followBack) isFriend = true;

    res.json({ success: true, isFollowing, isFriend });
});

function createFollowNotification(senderId, recipientId) {
    let notifications = readJsonFile(NOTIFICATIONS_FILE);
    const sender = findUserById(senderId);
    const newNoti = {
        id: Date.now(),
        recipientId: String(recipientId),
        senderId: String(senderId),
        senderName: sender ? sender.name : "Someone",
        senderAvatar: sender ? sender.avatar : "",
        message: `ได้เริ่มติดตามคุณ`,
        read: false,
        time: new Date().toLocaleString('th-TH'),
        type: 'follow'
    };
    notifications.push(newNoti);
    saveJsonFile(NOTIFICATIONS_FILE, notifications);
}

// ==========================================
// 📚 API: Study Posts
// ==========================================
app.get('/api/study-posts', (req, res) => {
    try {
        const posts = readJsonFile(STUDY_POSTS_FILE);
        const users = readJsonFile(DB_FILE);
        const joinedPosts = posts.map(post => {
            const owner = users.find(u => String(u.id) === String(post.ownerId));
            return {
                ...post,
                owner_avatar: owner ? owner.avatar : post.avatar,
                owner_name: owner ? (owner.username || owner.name) : post.name
            };
        });
        res.json(joinedPosts.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/study-posts', (req, res) => {
    try {
        const newPost = req.body;
        const posts = readJsonFile(STUDY_POSTS_FILE);
        newPost.id = Date.now().toString();
        posts.push(newPost);
        saveJsonFile(STUDY_POSTS_FILE, posts);
        console.log(`📝 New Post Created: ${newPost.title}`);
        res.json({ success: true, post: newPost });
    } catch (err) { res.status(500).json({ error: "Cannot save post" }); }
});

app.delete('/api/study-posts/:id', (req, res) => {
    const { id } = req.params;
    let posts = readJsonFile(STUDY_POSTS_FILE);
    const initialLength = posts.length;
    const newPosts = posts.filter(p => String(p.id) !== String(id));
    if (newPosts.length < initialLength) {
        saveJsonFile(STUDY_POSTS_FILE, newPosts);
        res.json({ success: true, message: "ลบโพสต์สำเร็จ" });
    } else {
        res.status(404).json({ success: false, message: "ไม่พบโพสต์ที่จะลบ" });
    }
});

// ==========================================
// ✅ API: Registrations
// ==========================================
app.post('/api/registrations', (req, res) => {
    const { studentId, postId, studentName } = req.body;
    let registrations = readJsonFile(REGISTRATIONS_FILE);
    const existing = registrations.find(r => 
        String(r.studentId) === String(studentId) && String(r.postId) === String(postId)
    );
    if (existing) return res.status(400).json({ success: false, message: 'คุณได้ลงทะเบียนวิชานี้ไปแล้ว' });

    const newReg = {
        id: Date.now().toString(), studentId, studentName, postId, timestamp: new Date().toISOString()
    };
    registrations.push(newReg);
    saveJsonFile(REGISTRATIONS_FILE, registrations);
    res.json({ success: true, message: 'ลงทะเบียนสำเร็จ' });
});

app.get('/api/registrations', (req, res) => {
    const { studentId } = req.query;
    const registrations = readJsonFile(REGISTRATIONS_FILE);
    if (studentId) {
        const myRegis = registrations.filter(r => String(r.studentId) === String(studentId));
        return res.json(myRegis);
    }
    res.json(registrations);
});

app.delete('/api/cancel-registration', (req, res) => {
    const { courseId, studentId } = req.body;
    let registrations = readJsonFile(REGISTRATIONS_FILE);
    const regIndex = registrations.findIndex(r => 
        String(r.postId) === String(courseId) && String(r.studentId) === String(studentId)
    );
    if (regIndex !== -1) {
        registrations.splice(regIndex, 1);
        saveJsonFile(REGISTRATIONS_FILE, registrations);
        res.json({ success: true, message: 'ยกเลิกการลงทะเบียนสำเร็จ' });
    } else {
        res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการลงทะเบียน' });
    }
});

app.post('/api/register-course', (req, res) => {
    const { courseId, studentId, studentName, tutorId } = req.body;
    let registrations = readJsonFile(REGISTRATIONS_FILE);
    const existing = registrations.find(r => 
        String(r.studentId) === String(studentId) && String(r.postId) === String(courseId)
    );
    if (existing) return res.status(400).json({ success: false, message: 'คุณได้ส่งคำขอเรียนวิชานี้ไปแล้ว' });

    registrations.push({
        id: Date.now().toString(), studentId, studentName, postId: courseId, timestamp: new Date().toISOString()
    });
    saveJsonFile(REGISTRATIONS_FILE, registrations);

    const posts = readJsonFile(STUDY_POSTS_FILE);
    const targetPost = posts.find(p => String(p.id) === String(courseId));
    const courseTitle = targetPost ? targetPost.title : courseId;

    let notifications = readJsonFile(NOTIFICATIONS_FILE);
    const sender = findUserById(studentId);
    notifications.push({
        id: Date.now(),
        recipientId: String(tutorId), 
        senderId: String(studentId),
        senderName: studentName,
        senderAvatar: sender ? sender.avatar : "", 
        message: `ขอลงทะเบียนเรียนวิชา: ${courseTitle}`, 
        read: false,
        time: new Date().toLocaleString('th-TH'),
        type: 'register'
    });
    saveJsonFile(NOTIFICATIONS_FILE, notifications);
    res.status(200).json({ success: true, message: 'ส่งคำขอเรียนเรียบร้อยแล้ว' });
});

// ==========================================
// 💬 API: Global Chat (แชทกลุ่มรวม)
// ==========================================
app.get('/api/chat', (req, res) => {
    const messages = readJsonFile(CHAT_FILE);
    res.json(messages);
});

app.post('/api/chat', (req, res) => {
    const messages = readJsonFile(CHAT_FILE);
    const { user, sender, text, avatar } = req.body; 
    const actualUser = sender || user;
    
    // Debug Log
    console.log("📢 Global Chat:", text, "From:", actualUser);

    if (!text) return res.status(400).json({error: "No text"});

    let userAvatar = avatar;
    if (!userAvatar) {
        const u = readJsonFile(DB_FILE).find(u => u.name === actualUser);
        userAvatar = u ? u.avatar : "https://via.placeholder.com/40";
    }

    const newMsg = { 
        sender: actualUser, user: actualUser, text, 
        avatar: userAvatar, time: new Date().toISOString() 
    };
    messages.push(newMsg);
    if (messages.length > 50) messages.shift();
    saveJsonFile(CHAT_FILE, messages);
    res.json(newMsg);
});

// ==========================================
// 🔐 API: Private Chat (แชทส่วนตัว) - NEW!
// ==========================================

// 1. ส่งข้อความส่วนตัว
app.post('/api/private-chat', (req, res) => {
    const { fromId, toId, message, senderAvatar, senderName } = req.body;
    
    // Debug Log
    console.log(`📨 Private Msg: ${fromId} -> ${toId}: ${message}`);

    const allChats = readJsonFile(PRIVATE_CHAT_FILE);
    const newChat = {
        id: Date.now(),
        fromId, toId, message, senderAvatar, senderName,
        timestamp: new Date().toISOString(),
        read: false
    };

    allChats.push(newChat);
    saveJsonFile(PRIVATE_CHAT_FILE, allChats); 
    res.json({ success: true });
});

// 2. ดึงข้อความที่คุยกับคนๆ หนึ่ง (Conversation)
app.get('/api/private-chat/:userId/:partnerId', (req, res) => {
    const { userId, partnerId } = req.params;
    const allChats = readJsonFile(PRIVATE_CHAT_FILE);
    
    const conversation = allChats.filter(c => 
        (String(c.fromId) === String(userId) && String(c.toId) === String(partnerId)) || 
        (String(c.fromId) === String(partnerId) && String(c.toId) === String(userId))
    );
    
    conversation.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(conversation);
});

// 3. ดึงรายชื่อคนที่เคยคุยด้วย (Inbox List)
app.get('/api/chat-inbox/:userId', (req, res) => {
    const { userId } = req.params;
    const allChats = readJsonFile(PRIVATE_CHAT_FILE);
    const allUsers = readJsonFile(DB_FILE); 
    
    const myChats = allChats.filter(c => String(c.fromId) === String(userId) || String(c.toId) === String(userId));
    const inboxMap = new Map();
    
    myChats.forEach(chat => {
        const isMeSender = String(chat.fromId) === String(userId);
        const partnerId = isMeSender ? chat.toId : chat.fromId;
        
        if (!inboxMap.has(partnerId) || new Date(chat.timestamp) > new Date(inboxMap.get(partnerId).timestamp)) {
            // หาชื่อจริงจาก DB (กันชื่อ Unknown)
            const partnerUser = allUsers.find(u => String(u.id) === String(partnerId));
            const partnerName = partnerUser ? (partnerUser.username || partnerUser.name) : (isMeSender ? (inboxMap.get(partnerId)?.partnerName || 'Unknown') : chat.senderName);
            const partnerAvatar = partnerUser ? partnerUser.avatar : (isMeSender ? (inboxMap.get(partnerId)?.partnerAvatar || '') : chat.senderAvatar);

            inboxMap.set(partnerId, {
                partnerId,
                lastMessage: chat.message,
                timestamp: chat.timestamp,
                partnerName,
                partnerAvatar
            });
        }
    });

    const inboxList = Array.from(inboxMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(inboxList);
});

// ==========================================
// ✅ API: Get User's Courses
// ==========================================
app.get('/api/users/:userId/courses', (req, res) => {
    const { userId } = req.params;
    try {
        const registrations = readJsonFile(REGISTRATIONS_FILE);
        const posts = readJsonFile(STUDY_POSTS_FILE);
        
        const myRegs = registrations.filter(r => String(r.studentId) === String(userId));
        const myCourses = myRegs.map(reg => {
            return posts.find(p => String(p.id) === String(reg.postId));
        }).filter(item => item !== undefined); 

        res.json(myCourses);
    } catch (error) {
        console.error("Error fetching courses:", error);
        res.json([]);
    }
});

// ==========================================
// Start Server
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    
    // ✅ เช็คและสร้างไฟล์ที่จำเป็นอัตโนมัติ
    [DB_FILE, STUDY_POSTS_FILE, CHAT_FILE, NOTIFICATIONS_FILE, REGISTRATIONS_FILE, FOLLOWS_FILE, PRIVATE_CHAT_FILE].forEach(file => {
        const filePath = path.resolve(__dirname, file);
        if (!fs.existsSync(filePath)) {
            console.log(`📂 Creating new file: ${file}`);
            saveJsonFile(file, []);
        }
    });
});