const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect("mongodb://localhost:27017/libraryDB");

const bookSchema = new mongoose.Schema({
  code: {
    type: String,
  },
  title: {
    type: String,
  },
  author: {
    type: String,
  },
  stock: {
    type: Number,
  },
});

const memberSchema = new mongoose.Schema({
  code: {
    type: String,
  },
  name: {
    type: String,
  },
  bookDetail: [
    {
      code: {
        type: String,
        default: null,
      },
      borrowedAt: {
        type: Date,
        default: null,
      },
    },
  ],
  isPenalized: {
    type: Boolean,
    default: false,
  },
  penalizedAt: {
    type: Date,
    default: null,
  },
});

const Book = mongoose.model("book", bookSchema);
const Member = mongoose.model("member", memberSchema);

const listBooks = [
  {
    code: "JK-45",
    title: "Harry Potter",
    author: "J.K Rowling",
    stock: 1,
  },
  {
    code: "SHR-1",
    title: "A Study in Scarlet",
    author: "Arthur Conan Doyle",
    stock: 1,
  },
  {
    code: "TW-11",
    title: "Twilight",
    author: "Stephenie Meyer",
    stock: 1,
  },
  {
    code: "HOB-83",
    title: "The Hobbit, or There and Back Again",
    author: "J.R.R. Tolkien",
    stock: 1,
  },
  {
    code: "NRN-7",
    title: "The Lion, the Witch and the Wardrobe",
    author: "C.S. Lewis",
    stock: 1,
  },
];

const listMembers = [
  {
    code: "M001",
    name: "Angga",
  },
  {
    code: "M002",
    name: "Ferry",
  },
  {
    code: "M003",
    name: "Putri",
  },
];

async function insertBook(data) {
  await Book.insertMany(data);
}

async function insertMember(data) {
  await Member.insertMany(data);
}

async function checkBookDB() {
  const books = await Book.find();

  const isEmpty = books.length === 0 ? true : false;

  return isEmpty;
}

async function checkMemberDB() {
  const members = await Member.find();

  const isEmpty = members.length === 0 ? true : false;

  return isEmpty;
}

function penalizedCheck(date) {
  const dateBorrowed = new Date(date);

  const days = dateDiff(dateBorrowed);

  return (isPenalized = days > 7 ? true : false);
}

function expiredCheck(date) {
  const datePenalized = new Date(date);

  const days = dateDiff(datePenalized);

  return (isExpired = days > 3 ? true : false);
}

function dateDiff(date) {
  const diffTime = Math.abs(new Date() - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

app.get("/", async function (req, res) {
  const checkBooks = await Book.find();
  const checkMembers = await Member.find();

  if (checkBooks.length === 0) {
    await insertBook(listBooks);
  }

  if (checkMembers.length === 0) {
    await insertMember(listMembers);
  }

  return res.status(200).send("Eigen Library 1.0");
});

app.get("/list-book", async function (req, res) {
  const checkBooks = await Book.find();
  let availableBooks;

  if (checkBooks.length === 0) {
    await insertBook(listBooks);
    availableBooks = await Book.find({ stock: { $gt: 0 } });
  } else {
    availableBooks = await Book.find({ stock: { $gt: 0 } });
  }

  res.send(availableBooks);
});

app.get("/list-member", async function (req, res) {
  const checkMembers = await Member.find();
  let availableMembers;

  if (checkMembers.length === 0) {
    await insertMember(listMembers);
    availableMembers = await Member.find();
  } else {
    availableMembers = await Member.find();
  }

  res.send(availableMembers);
});

app.post(
  "/checkout",
  body("member_code").exists().withMessage("member_code is required."),
  body("book_code").exists().withMessage("book_code is required."),
  async function (req, res) {
    const isEmptyBook = await checkBookDB();
    const isEmptyMember = await checkMemberDB();
    if (isEmptyBook || isEmptyMember) {
      return res
        .status(404)
        .send("Error, The systems failed to load books or members");
    }

    // body param validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    memberCode = req.body.member_code;
    bookCode = req.body.book_code;

    // check if book is available
    const checkBooks = await Book.findOne({ code: bookCode });
    if (checkBooks.stock === 0) {
      return res
        .status(404)
        .send("Sorry " + checkBooks.title + " is already borrowed");
    }

    // check if member has borrowed a book
    const checkMembers = await Member.findOne({ code: memberCode });
    if (
      checkMembers.bookDetail.length !== 0 &&
      checkMembers.bookDetail.length === 2
    ) {
      return res
        .status(400)
        .send("Sorry, you've already borrowed 2 books, return it first");
    }

    // check penalized
    if (checkMembers.isPenalized) {
      const isExpired = expiredCheck(checkMembers.penalizedAt);
      if (isExpired) {
        const memberUpdate = {
          isPenalized: false,
          penalizedAt: null,
        };
        await Member.updateOne({ code: checkMembers.code }, memberUpdate);
      } else {
        return res
          .status(400)
          .send("Error, can't checkout book because you're still penalized");
      }
    }

    // variable update member book detail
    const updateMember = {
      code: checkBooks.code,
      borrowedAt: new Date(),
    };

    // variable update book stock
    const updateBook = {
      stock: Number(checkBooks.stock - 1),
    };

    await Member.updateOne(
      { code: checkMembers.code },
      { $push: { bookDetail: updateMember } }
    );
    await Book.updateOne({ code: checkBooks.code }, updateBook);
    res.send("Successfully checkout " + checkBooks.title);
  }
);

app.post(
  "/return",
  body("member_code").exists().withMessage("member_code is required."),
  body("book_code").exists().withMessage("book_code is required."),
  async function (req, res) {
    const isEmptyBook = await checkBookDB();
    const isEmptyMember = await checkMemberDB();
    if (isEmptyBook || isEmptyMember) {
      return res
        .status(404)
        .send("Error, The systems failed to load books or members");
    }

    // body param validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    memberCode = req.body.member_code;
    bookCode = req.body.book_code;

    const checkMembers = await Member.findOne({ code: memberCode });
    const checkBooks = await Book.findOne({ code: bookCode });

    if (checkMembers.bookDetail.length === 0) {
      return res.status(400).send("Error, You're not borrowed any books!");
    }

    let isExist = false;
    let currentReturnedBook = [];

    checkMembers.bookDetail.forEach((val, key) => {
      if (val.code === checkBooks.code) {
        isExist = true;
        currentReturnedBook = val;
      }
    });

    if (!isExist) {
      return res
        .status(400)
        .send(
          "Error, the returned book is not matched with any of your borrowed book"
        );
    }

    const isPenalized = penalizedCheck(currentReturnedBook.borrowedAt);

    const updateMember = isPenalized
      ? {
          $pull: { bookDetail: { code: currentReturnedBook.code } },
          isPenalized: isPenalized,
          penalizedAt: new Date(),
        }
      : { $pull: { bookDetail: { code: currentReturnedBook.code } } };

    const updateBook = {
      stock: Number(checkBooks.stock + 1),
    };

    await Member.updateOne({ code: checkMembers.code }, updateMember);
    await Book.updateOne({ code: checkBooks.code }, updateBook);
    return isPenalized
      ? res
          .status(200)
          .send(
            "Successfully returned " +
              checkBooks.title +
              ", But you've got Penalized"
          )
      : res.status(200).send("Successfully returned " + checkBooks.title);
  }
);

app.listen(3030, function () {
  console.log("Server is running");
});
