import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, updateDoc, deleteDoc, query, where, onSnapshot, getDocs, serverTimestamp, orderBy, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3fovDzCF_3mCFD4yGsvgCFfan_tuDc3Y",
    authDomain: "studenthub-599bf.firebaseapp.com",
    projectId: "studenthub-599bf",
    storageBucket: "studenthub-599bf.firebasestorage.app",
    messagingSenderId: "46949030478",
    appId: "1:46949030478:web:75e914274035b1d5d8c11f"
};
const CLOUD_NAME = "dvmwnkyyh";
const UPLOAD_PRESET = "StudentHub";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let isAdmin = false;
let isMaster = false;
let presenceInterval = null;
let lastAdminTap = 0;
let currentPreviewUrl = '';
let currentPreviewType = '';

// --- QUOTES SYSTEM ---
const quotes = [
    { text: "Education is the passport to the future.", author: "Malcolm X" },
    { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle" },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "Education is the lighting of a fire.", author: "W.B. Yeats" },
    { text: "Change is the end result of all true learning.", author: "Leo Buscaglia" },
    { text: "The only source of knowledge is experience.", author: "Albert Einstein" },
    { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { text: "Success is the sum of small efforts.", author: "Robert Collier" },
    { text: "Strive for progress, not perfection.", author: "Unknown" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" }
];

function displayRandomQuote() {
    const elText = document.getElementById('quote-text');
    if (elText) {
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        elText.innerText = `“${randomQuote.text}”`;
    }
}
displayRandomQuote();

// --- UTILS ---
window.nav = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id === 'admin' ? 'admin-dash' : id).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.bar-item').forEach(b => b.classList.remove('active'));

    const dIdx = ['home', 'files', 'drive', 'about', 'admin'].indexOf(id);
    if (dIdx > -1) {
        if (document.querySelectorAll('.nav-item')[dIdx]) document.querySelectorAll('.nav-item')[dIdx].classList.add('active');
        if (document.querySelectorAll('.bar-item')[dIdx]) document.querySelectorAll('.bar-item')[dIdx].classList.add('active');
    }
    window.scrollTo(0, 0);
}

window.switchFileView = (view) => {
    document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');

    document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.tab-pill');
    if (view === 'browse') btns[0].classList.add('active');
    else if (view === 'resources') btns[1].classList.add('active');
    else btns[2].classList.add('active');
}

// NEW ADMIN TABS LOGIC
window.switchAdminTab = (tab, btn) => {
    document.querySelectorAll('.adm-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`adm-${tab}`).classList.add('active');
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

window.toggleProfile = (e) => {
    e.stopPropagation();
    document.getElementById('profile-dropdown').classList.toggle('show');
}
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    const avatar = document.querySelector('.profile-avatar');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && !avatar.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    }
});

window.toast = (msg, type = 'info') => {
    const box = document.getElementById('toast-box');
    const el = document.createElement('div');
    el.className = 'snackbar';
    if (type === 'error') el.style.backgroundColor = 'var(--error)';
    if (type === 'success') el.style.backgroundColor = 'var(--success)';
    el.innerHTML = `<span>${msg}</span>`;
    box.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

window.filterFiles = (term) => {
    const container = document.getElementById('public-gallery');
    if (container) {
        container.querySelectorAll('.list-tile').forEach(c => {
            const title = c.querySelector('.tile-title');
            if (title) c.style.display = title.innerText.toLowerCase().includes(term.toLowerCase()) ? 'flex' : 'none';
        });
    }
}

window.filterUserList = (term) => {
    const container = document.getElementById('all-user-list');
    if (container) {
        // Updated selector for new card based layout
        container.querySelectorAll('.user-card').forEach(c => {
            c.style.display = c.innerText.toLowerCase().includes(term.toLowerCase()) ? 'flex' : 'none';
        });
    }
}

// --- AUTH ---
window.googleLogin = () => signInWithPopup(auth, provider).catch(e => window.toast(e.message, 'error'));
window.logout = () => signOut(auth).then(() => window.location.reload());

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().banned) {
            await signOut(auth);
            alert("Account Banned.");
            return;
        }

        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('profile-container').style.display = 'block';

        document.getElementById('user-avatar').src = user.photoURL || 'https://via.placeholder.com/40';
        document.getElementById('user-name-display').innerText = user.displayName;

        checkSubAdmin(user.email);
        registerUser(user);
        startPresence(user);
        loadAllFiles();
        loadResources();
    } else {
        if (presenceInterval) clearInterval(presenceInterval);
        document.getElementById('login-btn').style.display = 'inline-flex';
        document.getElementById('profile-container').style.display = 'none';
        loadAllFiles();
        loadResources();
    }
});

async function registerUser(user) {
    try { await setDoc(doc(db, "users", user.uid), { email: user.email, name: user.displayName, lastSeen: serverTimestamp(), banned: false }, { merge: true }); } catch (e) { }
}
function startPresence(user) {
    const ref = doc(db, "presence", user.uid);
    const heartbeat = () => setDoc(ref, { email: user.email, uid: user.uid, lastActive: serverTimestamp() });
    heartbeat();
    presenceInterval = setInterval(heartbeat, 30000);
    window.addEventListener('beforeunload', () => deleteDoc(ref));
}

// --- ADMIN ---
window.handleAdminClick = (e) => {
    if (isAdmin) { window.nav('admin'); return; }
    const currentTime = new Date().getTime();
    const isDoubleTap = (currentTime - lastAdminTap) < 400;
    lastAdminTap = currentTime;

    if ((e && (e.ctrlKey || e.metaKey)) || isDoubleTap) {
        document.getElementById('admin-modal').style.display = 'flex';
        return;
    }
    window.toast("Restricted Access", "error");
}

window.verifyAdmin = () => {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;

    if (u === "rrrr" && p === "0000") {
        isMaster = true;
        activateAdmin();
        document.getElementById('admin-modal').style.display = 'none';
        window.toast("Master Access Granted", "success");
    } else {
        window.toast("Invalid Credentials", "error");
    }
}

async function checkSubAdmin(email) {
    const snap = await getDocs(query(collection(db, "admins"), where("email", "==", email)));
    if (!snap.empty) { activateAdmin(); window.toast(`Welcome Admin`, "success"); }
}

function activateAdmin() {
    isAdmin = true;
    document.body.classList.add('is-admin');
    if (isMaster) {
        document.getElementById('master-admin-section').style.display = 'block';
        loadBannedUsers();
    } else {
        document.getElementById('master-admin-section').style.display = 'none';
    }
    loadStats(); loadAllFiles(); loadResources(); loadAdminList(); loadUserManagement(); loadLogs();
}

window.logoutAdmin = () => {
    isAdmin = false; isMaster = false;
    document.body.classList.remove('is-admin');
    document.getElementById('master-admin-section').style.display = 'none';
    window.nav('home'); loadAllFiles(); loadResources();
    window.toast("Admin Session Ended");
}

const logAction = (msg) => { if (isAdmin && currentUser) addDoc(collection(db, "logs"), { message: `${currentUser.displayName}: ${msg}`, timestamp: serverTimestamp() }); }
function loadLogs() {
    onSnapshot(query(collection(db, "logs"), orderBy("timestamp", "desc")), (snap) => {
        let html = "";
        let i = 0;
        snap.forEach(doc => {
            html += `<div class="list-tile small" style="animation-delay: ${Math.min(i++ * 0.05, 1.0)}s"><div class="tile-content">${doc.data().message}</div></div>`;
        });
        document.getElementById('admin-activity-log').innerHTML = html || '<div class="empty-state small">No activity</div>';
    });
}

// UPDATED USER MANAGEMENT TO USE NEW CARD LAYOUT
function loadUserManagement() {
    onSnapshot(collection(db, "users"), (snap) => {
        let html = "";
        let i = 0;
        snap.forEach(doc => {
            const u = doc.data();
            let btn = '';
            if (isMaster) {
                btn = u.banned ?
                    `<button onclick="window.unbanUser('${doc.id}')" class="md-btn small text">Unban</button>` :
                    `<button onclick="window.banUser('${doc.id}')" class="md-btn small text danger">Ban</button>`;
            }
            html += `
            <div class="user-card" style="animation-delay: ${Math.min(i++ * 0.05, 1.0)}s">
                <div class="tile-icon"><i class="fas fa-user"></i></div>
                <div class="user-info">
                    <div class="user-name">${u.name}</div>
                    <div class="user-email">${u.email}</div>
                </div>
                ${btn}
            </div>`;
        });
        document.getElementById('all-user-list').innerHTML = html;
    });
}

function loadBannedUsers() {
    onSnapshot(query(collection(db, "users"), where("banned", "==", true)), (snap) => {
        let html = "";
        snap.forEach(doc => {
            const u = doc.data();
            html += `
            <div class="list-tile">
                <div class="tile-content">
                    <div class="tile-title" style="color:var(--error)">${u.name}</div>
                    <div class="tile-sub">${u.email}</div>
                </div>
                <button onclick="window.unbanUser('${doc.id}')" class="md-btn text">Unban</button>
            </div>`;
        });
        document.getElementById('banned-user-list').innerHTML = html || '<div class="empty-state small">None</div>';
    });
}

window.banUser = async (uid) => { if (!isMaster) return; if (confirm("Ban user?")) { await updateDoc(doc(db, "users", uid), { banned: true }); logAction("Banned user"); } }
window.unbanUser = async (uid) => { if (!isMaster) return; await updateDoc(doc(db, "users", uid), { banned: false }); logAction("Unbanned user"); }
window.addSubAdmin = async () => { if (!isMaster) return; const email = document.getElementById('sub-admin-email').value; if (!email) return; await addDoc(collection(db, "admins"), { email }); document.getElementById('sub-admin-email').value = ''; logAction("Added admin"); window.toast("Admin Added", "success"); }
window.removeAdmin = async (id) => { if (!isMaster) return; if (confirm("Remove admin?")) { await deleteDoc(doc(db, "admins", id)); logAction("Removed admin"); } }
function loadAdminList() { onSnapshot(collection(db, "admins"), (snap) => { let html = ""; snap.forEach(doc => { const delBtn = isMaster ? `<button onclick="window.removeAdmin('${doc.id}')" class="icon-btn-plain" style="color:var(--error)"><i class="fas fa-times"></i></button>` : ''; html += `<div class="list-tile small"><div class="tile-content tile-title" style="font-size:0.85rem">${doc.data().email}</div>${delBtn}</div>`; }); document.getElementById('admin-list').innerHTML = html || 'None'; }); }

async function loadStats() {
    const snap = await getCountFromServer(collection(db, "users"));
    document.getElementById('stat-total-users').innerText = snap.data().count;

    onSnapshot(collection(db, "presence"), (snapshot) => {
        let activeCount = 0;
        let activeListHtml = "";
        const now = Date.now();

        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.lastActive) {
                if (now - (d.lastActive.toMillis ? d.lastActive.toMillis() : Date.now()) < 120000) {
                    activeCount++;
                    activeListHtml += `
                    <div class="online-user-row">
                        <div class="status-dot"></div>
                        <span>${d.email}</span>
                    </div>`;
                }
            }
        });
        document.getElementById('stat-active-users').innerText = activeCount;
        document.getElementById('active-user-list-specific').innerHTML = activeListHtml || '<div class="empty-state small">None</div>';
    });
}

// UPLOAD
window.uploadFile = async () => {
    if (!currentUser) return window.toast("Login required", "error");
    const files = document.getElementById('file-input').files;
    const baseTitle = document.getElementById('file-title').value.trim();
    if (files.length === 0) return window.toast("No files selected", "error");

    document.getElementById('upload-btn-el').disabled = true;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        document.getElementById('progress-text').innerText = `Uploading ${i + 1}/${files.length}`;
        document.getElementById('progress-fill').style.width = `${((i + 1) / files.length) * 100}%`;

        const title = baseTitle ? (files.length > 1 ? `${baseTitle} (${i + 1})` : baseTitle) : file.name;
        const type = file.type.includes('pdf') ? 'PDF' : 'Image';
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            await addDoc(collection(db, "files"), { title, url: data.secure_url, type, uploader: currentUser.displayName, status: isAdmin ? 'approved' : 'pending', timestamp: serverTimestamp() });
        } catch (e) { window.toast("Upload error", "error"); }
    }
    window.toast("Upload Complete", "success");
    document.getElementById('file-title').value = '';
    document.getElementById('upload-btn-el').disabled = false;
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-text').innerText = '';
}

// --- RESOURCES SYSTEM ---
window.addResource = async () => {
    if (!isAdmin) return window.toast("Admin only", "error");

    const title = document.getElementById('res-title').value;
    const url = document.getElementById('res-url').value;
    const fileInput = document.getElementById('res-file-input');

    if (!title) return window.toast("Please enter a title", "error");

    let finalUrl = url;
    const btn = document.getElementById('add-res-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        document.getElementById('res-progress-container').style.display = 'block';
        document.getElementById('res-progress-fill').style.width = '50%';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            finalUrl = data.secure_url;
            document.getElementById('res-progress-fill').style.width = '100%';
        } catch (e) {
            btn.disabled = false;
            btn.innerText = "Add to Resources";
            document.getElementById('res-progress-container').style.display = 'none';
            return window.toast("File Upload Failed", "error");
        }
    }

    if (!finalUrl) {
        btn.disabled = false;
        btn.innerText = "Add to Resources";
        return window.toast("Please enter a URL or select a file", "error");
    }

    try {
        await addDoc(collection(db, "resources"), {
            title: title,
            url: finalUrl,
            type: 'PDF',
            addedBy: currentUser.displayName,
            timestamp: serverTimestamp()
        });
        document.getElementById('res-title').value = '';
        document.getElementById('res-url').value = '';
        document.getElementById('res-file-input').value = '';
        document.getElementById('res-progress-container').style.display = 'none';
        document.getElementById('res-progress-fill').style.width = '0%';
        window.toast("Resource Added", "success");
    } catch (e) {
        window.toast("Error adding resource", "error");
    }

    btn.disabled = false;
    btn.innerText = "Add to Resources";
}

window.deleteResource = async (id) => {
    if (!isAdmin) return;
    if (confirm("Delete this resource?")) {
        await deleteDoc(doc(db, "resources", id));
        window.toast("Resource deleted", "info");
    }
}

function loadResources() {
    onSnapshot(query(collection(db, "resources"), orderBy("timestamp", "desc")), (snap) => {
        let html = "";
        if (snap.empty) {
            document.getElementById('resources-list').innerHTML = `<div class="empty-state"><i class="fas fa-book-open"></i><span>No resources added yet.</span></div>`;
            return;
        }
        snap.forEach(doc => {
            const d = doc.data();
            const deleteBtn = isAdmin ? `<button class="md-btn text danger" onclick="window.deleteResource('${doc.id}')"><i class="fas fa-trash"></i></button>` : '';
            html += `<div class="list-tile"><div class="tile-icon gradient-green" style="color:white;"><i class="fas fa-book"></i></div><div class="tile-content"><div class="tile-title">${d.title}</div><div class="tile-sub">Free Resource</div></div><button class="md-btn text" onclick="window.open('${d.url}')"><i class="fas fa-download"></i></button><button class="md-btn text" onclick="window.openPreview('${d.url}','PDF','${d.title}')">View</button>${deleteBtn}</div>`;
        });
        document.getElementById('resources-list').innerHTML = html;
    });
}

// ADMIN ACTIONS
window.approve = (id) => { if (confirm("Approve?")) updateDoc(doc(db, "files", id), { status: 'approved' }).then(() => window.toast("Approved", "success")); }
window.rejectFile = (id) => { if (confirm("Reject?")) updateDoc(doc(db, "files", id), { status: 'rejected' }); }
window.deleteFile = (id) => { if (confirm("Delete?")) deleteDoc(doc(db, "files", id)); }
window.deleteNotice = (id) => { if (confirm("Delete?")) deleteDoc(doc(db, "notices", id)); }
window.deleteDrive = (id) => { if (confirm("Delete?")) deleteDoc(doc(db, "drive_links", id)); }
window.renameFile = async (id, old) => { const n = prompt("Name:", old); if (n && n !== old) updateDoc(doc(db, "files", id), { title: n }); }

window.userRenameFile = async (id, old) => { const n = prompt("Rename your file:", old); if (n && n !== old) { await updateDoc(doc(db, "files", id), { title: n }); window.toast("File Renamed", "success"); } }
window.editNotice = async (id, old) => { const n = prompt("Edit Notice:", old); if (n && n !== old) await updateDoc(doc(db, "notices", id), { message: n }); }
window.editDriveLink = async (id, oldTitle) => { const n = prompt("Edit Title:", oldTitle); if (n && n !== oldTitle) await updateDoc(doc(db, "drive_links", id), { title: n }); }

window.postNotice = async () => { const m = document.getElementById('admin-msg').value; if (m) { await addDoc(collection(db, "notices"), { message: m, author: 'Admin', timestamp: serverTimestamp() }); document.getElementById('admin-msg').value = ''; window.toast("Posted", "success"); } }
window.addDriveLink = async () => { const t = document.getElementById('drive-title').value; const u = document.getElementById('drive-url').value; if (t && u) { await addDoc(collection(db, "drive_links"), { title: t, url: u, timestamp: serverTimestamp() }); document.getElementById('drive-title').value = ''; document.getElementById('drive-url').value = ''; window.toast("Added", "success"); } }

function loadAllFiles() {
    onSnapshot(collection(db, "files"), (snap) => {
        let pub = "", pen = "", my = "";
        const fs = []; snap.forEach(d => fs.push({ id: d.id, ...d.data() }));
        fs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        let i = 0;
        fs.forEach(d => {
            const delay = `style="animation-delay: ${Math.min(i++ * 0.05, 1.0)}s"`;
            const iconClass = d.type === 'PDF' ? 'icon-pdf' : 'icon-img';
            const iconHtml = d.type === 'PDF' ? `<i class="fas fa-file-pdf"></i>` : `<i class="fas fa-image"></i>`;

            if (d.status === 'approved') {
                const dl = currentUser ? `<button class="md-btn text" onclick="window.open('${d.url}')"><i class="fas fa-download"></i></button>` : `<button class="md-btn text" style="opacity:0.5" onclick="window.toast('Login Required')"><i class="fas fa-lock"></i></button>`;
                pub += `<div class="list-tile" ${delay}><div class="tile-icon ${iconClass}">${iconHtml}</div><div class="tile-content"><div class="tile-title">${d.title}</div><div class="tile-sub">${d.uploader}</div></div>${dl}<button class="md-btn text" onclick="window.openPreview('${d.url}','${d.type}','${d.title}')">View</button><div class="admin-controls-overlay"><button class="md-btn text" onclick="window.renameFile('${d.id}', '${d.title}')"><i class="fas fa-pen"></i></button><button class="md-btn text danger" onclick="window.deleteFile('${d.id}')"><i class="fas fa-trash"></i></button></div></div>`;
            }
            if (d.status === 'pending') {
                pen += `<div class="list-tile" ${delay}><div class="tile-icon ${iconClass}">${iconHtml}</div><div class="tile-content"><div class="tile-title">${d.title}</div><div class="tile-sub">${d.uploader}</div></div><button class="md-btn text" onclick="window.openPreview('${d.url}','${d.type}','${d.title}')">View</button><button class="md-btn filled" onclick="window.approve('${d.id}')">OK</button><button class="md-btn text danger" onclick="window.rejectFile('${d.id}')">X</button></div>`;
            }
            if (currentUser && d.uploader === currentUser.displayName) {
                let badge = d.status === 'approved' ? '<span style="color:var(--success)">● Live</span>' : d.status === 'rejected' ? '<span style="color:var(--error)">● Rejected</span>' : '<span style="color:var(--warning)">● Pending</span>';
                my += `<div class="list-tile" ${delay}><div class="tile-icon ${iconClass}">${iconHtml}</div><div class="tile-content"><div class="tile-title">${d.title}</div><div class="tile-sub">${badge}</div></div><button class="md-btn text" onclick="window.userRenameFile('${d.id}', '${d.title}')"><i class="fas fa-pen"></i></button><button class="md-btn text danger" onclick="window.deleteFile('${d.id}')"><i class="fas fa-trash"></i></button></div>`;
            }
        });
        document.getElementById('public-gallery').innerHTML = pub || '<div class="empty-state">No files found</div>';
        document.getElementById('admin-pending-list').innerHTML = pen || '<div class="empty-state small">No pending files</div>';
        document.getElementById('my-status-list').innerHTML = my || '<div class="empty-state">No upload history</div>';
    });
}

onSnapshot(query(collection(db, "notices"), orderBy("timestamp", "desc")), (s) => {
    let h = "";
    let i = 0;
    s.forEach(d => {
        const msg = d.data().message;
        const actions = isAdmin ? `<button onclick="window.editNotice('${d.id}', '${msg}')" class="md-btn text"><i class="fas fa-pen"></i></button><button onclick="window.deleteNotice('${d.id}')" class="md-btn text danger"><i class="fas fa-trash"></i></button>` : '';
        h += `<div class="md-card glass" style="animation-delay: ${Math.min(i++ * 0.1, 1.0)}s"><div class="row-between"><p style="margin:0; font-weight:500;">${msg}</p><div>${actions}</div></div><small style="opacity:0.7; display:block; margin-top:8px; font-size:0.8rem;"><i class="far fa-clock"></i> ${new Date(d.data().timestamp?.toDate()).toLocaleDateString()}</small></div>`
    });
    document.getElementById('public-notices').innerHTML = h || '<div class="empty-state">No notices</div>'
});

onSnapshot(query(collection(db, "drive_links"), orderBy("timestamp", "desc")), (s) => {
    let h = "";
    let i = 0;
    s.forEach(d => {
        const actions = isAdmin ? `<button onclick="event.preventDefault();window.editDriveLink('${d.id}', '${d.data().title}')" class="md-btn text"><i class="fas fa-pen"></i></button><button onclick="event.preventDefault();window.deleteDrive('${d.id}')" class="md-btn text danger">X</button>` : '';
        h += `<a href="${d.data().url}" target="_blank" class="list-tile" style="text-decoration:none; color:inherit; animation-delay: ${Math.min(i++ * 0.05, 1.0)}s"><div class="tile-icon"><i class="fab fa-google-drive"></i></div><div class="tile-content"><div class="tile-title">${d.data().title}</div></div>${actions}</a>`
    });
    document.getElementById('drive-links-list').innerHTML = h || '<div class="empty-state">No links</div>'
});

window.openPreview = (url, type, title) => {
    currentPreviewUrl = url; currentPreviewType = type;
    document.getElementById('preview-title').innerText = title;
    document.getElementById('preview-modal').style.display = 'flex';
    window.switchPreviewMode('google');
}
window.switchPreviewMode = (mode) => {
    document.getElementById('preview-body').innerHTML = mode === 'google' ? `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(currentPreviewUrl)}&embedded=true"></iframe>` : `<object data="${currentPreviewUrl}" type="application/pdf" width="100%" height="100%"><p>Error</p></object>`;
}
window.openExternal = () => { window.open(currentPreviewUrl, '_blank'); }
window.closePreview = () => { document.getElementById('preview-modal').style.display = 'none'; document.getElementById('preview-body').innerHTML = ''; }