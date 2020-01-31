const {admin, db} = require("../utility/admin");
const config = require("../utility/config");
const firebase = require("firebase");
firebase.initializeApp(config);

const {validateSignupData, validateLoginData, reduceUserDetails} = require('../utility/validators');

//Sign up code
exports.signup = (req, res) => {
  const newUser = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle
  };

  const {valid, errors} = validateSignupData(newUser);
  if(!valid) return res.status(400).json({errors});
  
 const noImg=`no-img.png`;

  //Validating data
  let token, userID;
  db.doc(`/users/${newUser.handle}`)
    .get()
    .then(doc => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(newUser.email, newUser.password);
      }
    })
    .then(data => {
      userID = data.user.uid;
      return data.user.getIdToken();
    })
    .then(idToken => {
      token = idToken;
      const userCredentials = {
        handle: newUser.handle,
        email: newUser.email,
        createdAt: new Date().toISOString(),
        imageURL: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
        userID
      };
      return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch(err => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email is already in use" });
      } else {
        return res.status(500).json({ error: err.code });
      }
    });
};

//Log user in
exports.login = (req, res) => {
  const user = {
    email: req.body.email,
    password: req.body.password
  };

  const {valid, errors} = validateLoginData(user);
  if(!valid) return res.status(400).json({errors});

  firebase
    .auth()
    .signInWithEmailAndPassword(user.email, user.password)
    .then(data => {
      return data.user.getIdToken();
    })
    .then(token => {
      return res.json({ token });
    })
    .catch(err => {
      console.error(err);
      if ((err.code = "auth/wrong-password")) {
        return res
          .status(403)
          .json({ general: "Wrong credentials, please try again!" });
      } else return res.status(500).json({ error: err.code });
    });
};

//Add user details
exports.addUserDetails = (req, res) => {
  let userDetails = reduceUserDetails(req.body);

  db.doc(`/users/${req.user.handle}`).update(userDetails)
  .then(() => {
    return res.json({message: "Details added succesfully"});
  })
  .catch(err => {
    console.error(err);
    return res.status(500).json({error: err.code});
  })
}

//Get own User Details
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.handle}`).get()
  .then(doc => {
    if(doc.exists){
      userData.credentials = doc.data();
      return db.collection("likes").where("userHandle", "==", req.user.handle).get();
    }
  })
  .then(data => {
    userData.likes = []
    data.forEach(doc => {
      userData.likes.push(doc.data());
    })
    return res.json(userData);
  })
  .catch(err=> {
    console.error(err);
    return res.status(500).json({error: err.code});
  })
}


//Upload a profile image
exports.uploadImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const busboy = new BusBoy({headers: req.headers});

  let imageFileName;
  let imageToBeUploaded={};

  busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {
    if(mimetype !== "image/jpg" && mimetype !== "image/png") return res.status(400).json({error: "Wrong file type submitted"});
    console.log(fieldName);
    console.log(fileName);
    console.log(mimetype);
   const imageExtension =  fileName.split('.')[fileName.split('.').length-1];
   imageFileName = `${Math.round(Math.random()*100000000000)}.${imageExtension}`;
   const filepath = path.join(os.tmpdir(), imageFileName);
   imageToBeUploaded = {
     filepath, mimetype
   }
   file.pipe(fs.createWriteStream(filepath));
  });

  busboy.on('finish', ()=> {
    admin.storage().bucket().upload(imageToBeUploaded.filepath, {
      resumable: false,
      metadata: {
        metadata: {
          contentType: imageToBeUploaded.mimetype
        }
      }
    })
    .then(()=>{
      const imageURL = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
      return db.doc(`/users/${req.user.handle}`).update({imageURL});
    })
    .then(()=>{
      res.json({message: "Image uploaded succesfully"});
    })
    .catch(err=>{
      console.error(err);
      return res.status(500).json({error: err.code});
    });
  });
  busboy.end(req.rawBody);
}

