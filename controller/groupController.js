const path = require("path");
const User = require("../models/userModel");
const Group = require("../models/groupModel");
const UserGroup = require("../models/userGroup");
const { Op } = require("sequelize");

exports.createGroup = async (req, res) => {
  try {
    const { groupName, members } = req.body;
    const adminEmail = req.user.email;

    // Check if the group already exists
    const existingGroup = await Group.findOne({ where: { name: groupName } });
    if (existingGroup) {
      return res.status(400).json({ message: "Group already exists!" });
    }

    // Create the group
    const newGroup = await Group.create({
      name: groupName,
      admin: adminEmail,
    });

    // Find the admin user
    const adminUser = await User.findOne({ where: { email: adminEmail } });

    // **Delete any existing non-admin entries for this user in the group**
    await UserGroup.destroy({
      where: {
        userId: adminUser.id,
        groupId: newGroup.id,
        isadmin: false, // Ensures only non-admin entries are deleted
      },
    });

    // Add the admin as a member
    await UserGroup.create({
      userId: adminUser.id,
      groupId: newGroup.id,
      isadmin: true,
    });

    // Add other members
    if (members && Array.isArray(members)) {
      for (const memberEmail of members) {
        const user = await User.findOne({ where: { email: memberEmail } });
        if (user) {
          await UserGroup.create({
            userId: user.id,
            groupId: newGroup.id,
          });
        }
      }
    }

    res.status(201).json({ message: "Group created successfully!" });
  } catch (error) {
    console.error("Error in createGroup:", error);
    res.status(500).json({ message: "An error occurred while creating group" });
  }
};
exports.addToGroup = async (req, res, next) => {
  try {
    const groupName = req.body.groupName;
    const members = req.body.members;

    const group = await Group.findOne({ where: { name: groupName } });
    if (group) {
      const admin = await UserGroup.findOne({
        where: {
          [Op.and]: [{ isadmin: 1 }, { groupId: group.id }],
        },
      });
      if (admin.userId == req.user.id) {
        const invitedMembers = await User.findAll({
          where: {
            email: {
              [Op.or]: members,
            },
          },
        });

        await Promise.all(
          invitedMembers.map(async (user) => {
            const response = await UserGroup.create({
              isadmin: false,
              userId: user.dataValues.id,
              groupId: group.dataValues.id,
            });
          })
        );
        res.status(201).json({ message: "Members Added Successfully!" });
      } else {
        res.status(201).json({ message: "Only Admins Can Add New Members" });
      }
    } else {
      res.status(201).json({ message: "Group doesn't exists!" });
    }
  } catch (error) {
    console.log(error);
  }
};

exports.getGroups = async (req, res, next) => {
  try {
    const groups = await Group.findAll({
      attributes: ["name", "admin"],
      include: [
        {
          model: UserGroup,
          where: { userId: req.user.id },
        },
      ],
    });
    res.status(200).json({ groups: groups });
  } catch (error) {
    console.log(error);
  }
};

exports.deleteFromGroup = async (req, res, next) => {
  try {
    const groupName = req.body.groupName;
    const members = req.body.members;

    const group = await Group.findOne({ where: { name: groupName } });
    if (group) {
      const admin = await UserGroup.findOne({
        where: {
          [Op.and]: [{ isadmin: 1 }, { groupId: group.id }],
        },
      });
      if (admin.userId == req.user.id) {
        const invitedMembers = await User.findAll({
          where: {
            email: {
              [Op.or]: members,
            },
          },
        });

        await Promise.all(
          invitedMembers.map(async (user) => {
            const response = await UserGroup.destroy({
              where: {
                [Op.and]: [
                  {
                    isadmin: false,
                    userId: user.dataValues.id,
                    groupId: group.dataValues.id,
                  },
                ],
              },
            });
          })
        );
        res.status(201).json({ message: "Members Deleted Successfully!" });
      } else {
        res.status(201).json({ message: "Only Admins Can Delete Members" });
      }
    } else {
      res.status(201).json({ message: "Group doesn't exists!" });
    }
  } catch (error) {
    console.log(error);
  }
};

exports.groupMembers = async (req, res, next) => {
  try {
    const groupName = req.params.groupName;
    const group = await Group.findOne({ where: { name: groupName } });
    const userGroup = await UserGroup.findAll({
      where: { groupId: group.dataValues.id },
    });

    const users = [];

    await Promise.all(
      userGroup.map(async (user) => {
        const res = await User.findOne({
          where: { id: user.dataValues.userId },
        });
        users.push(res);
      })
    );
    res.status(200).json({ users: users });
  } catch (error) {
    console.log(error);
  }
};
