const path = require("path");
const User = require("../models/userModel");
const ResetPassword = require("../models/resetPasswordModel");
const bcrypt = require("bcrypt");
const Sib = require("sib-api-v3-sdk");
const { v4: uuidv4 } = require("uuid");
const saltRounds = 10;

const hashPassword = async (password) => {
  return await bcrypt.hash(password, saltRounds);
};

exports.forgotPasswordPage = async (req, res, next) => {
  try {
    res
      .status(200)
      .sendFile(
        path.join(__dirname, "../", "public", "views", "forgotPassword.html")
      );
  } catch (error) {
    console.log(error);
  }
};

exports.sendMail = async (req, res, next) => {
  try {
    const email = req.body.email;
    const requestId = uuidv4();

    const recepientEmail = await User.findOne({ where: { email: email } });

    if (!recepientEmail) {
      return res
        .status(404)
        .json({ message: "Please provide the registered email!" });
    }

    const resetRequest = await ResetPassword.create({
      id: requestId,
      isActive: true,
      userId: recepientEmail.dataValues.id,
    });

    const client = Sib.ApiClient.instance;
    const apiKey = client.authentications["api-key"];
    apiKey.apiKey = process.env.RESET_PASSWORD_API_KEY;

    if (!process.env.RESET_PASSWORD_API_KEY) {
      console.error("API key not set");
      return res.status(500).json({ message: "Internal server error" });
    }

    const transEmailApi = new Sib.TransactionalEmailsApi();
    const sender = {
      email: "rajthegreat2210@gmail.com",
      name: "Raj",
    };
    const receivers = [
      {
        email: email,
      },
    ];
    const emailResponse = await transEmailApi.sendTransacEmail({
      sender,
      to: receivers, // Note: lowercase 'to' should be used here
      subject: "Chat Password reset",
      textContent: "Link Below",
      htmlContent: `<h3>Hi! We got the request from you for reset the password. Here is the link below >>></h3>
      <a href="http://localhost:4000/password/resetPasswordPage/{{params.requestId}}"> Click Here</a>`,
      params: {
        requestId: requestId,
      },
    });

    console.log("Email sent:", emailResponse);

    return res.status(200).json({
      message:
        "Link for reset the password is successfully send on your Mail Id!",
    });
  } catch (error) {
    console.log("Error sending email:", error);
    return res.status(409).json({ message: "Failed changing password" });
  }
};

exports.resetPasswordPage = async (req, res, next) => {
  try {
    res
      .status(200)
      .sendFile(
        path.join(__dirname, "../", "public", "views", "resetPassword.html")
      );
  } catch (error) {
    console.log(error);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const requestId = req.headers.referer.split("/");
    const password = req.body.password;
    const checkResetRequest = await ResetPassword.findAll({
      where: { id: requestId[requestId.length - 1], isActive: true },
    });
    if (checkResetRequest[0]) {
      const userId = checkResetRequest[0].dataValues.userId;
      const result = await ResetPassword.update(
        { isActive: false },
        { where: { id: requestId } }
      );
      const newPassword = await hashPassword(password);
      const user = await User.update(
        { password: newPassword },
        { where: { id: userId } }
      );
      return res
        .status(200)
        .json({ message: "Successfully changed password!" });
    } else {
      return res
        .status(409)
        .json({ message: "Link is already used once, request for new link!" });
    }
  } catch (err) {
    // console.log(err);
    return res.status(409).json({ message: "Failed" });
  }
};
