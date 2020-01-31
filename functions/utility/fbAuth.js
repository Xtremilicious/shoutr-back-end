const {admin, db} = require('./admin');

module.exports = (req, res, next) => {
    let IDToken;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      IDToken = req.headers.authorization.split("Bearer ")[1];
    } else {
      console.error("No token found");
      return req.status(403).json({ error: "Unauthorized" });
    }
  
    admin
      .auth()
      .verifyIdToken(IDToken)
      .then(decodedToken => {
        req.user = decodedToken;
        return db
          .collection("users")
          .where("userID", "==", req.user.uid)
          .limit(1)
          .get();
      })
      .then(data => {
        req.user.handle = data.docs[0].data().handle;
        req.user.imageUrl = data.docs[0].data().imageUrl;
        return next();
      })
      .catch(err => {
        console.error("Error while verifying token");
        return res.status(403).json({ err });
      });
  };
  