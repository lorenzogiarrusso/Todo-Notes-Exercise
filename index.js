const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require('path');
const _ = require("lodash");
const cors = require('cors');
const { createCipheriv } = require("crypto");
app.use(cors());
// Set the view engine to EJS
app.set("view engine", "ejs");

// Middleware for parsing application/x-www-form-urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files directory
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const mongoDBUri = "mongodb+srv://giarrussolorenzo:t1otEqlgBECuv4NL@cluster0.hqzaedi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true });

const port = 3000;

const todoSchema = new mongoose.Schema({
    todoText: String,
    todoDue: Date,
    todoCompleted: { type: Boolean, default: false }
});

const noteSchema = new mongoose.Schema({
    title: String,
    description: String,
    todos: [todoSchema]
});

const Note = mongoose.model("Note", noteSchema);

app.get("/", async (req, res) => {
    try {
        const notes = await Note.find();
        res.render("home.ejs", { notes: notes });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Error fetching notes");
    }
});

app.get("/compose", (req, res) => {
    res.render("compose.ejs");
});

app.post("/compose", async (req, res) => {
    let newNote = new Note({
        title: req.body.title,
        description: req.body.description
    });

    if (req.body.todoText) { //To-dos aren't required, so it might be undefined.
        if (typeof req.body.todoText == "string") { // If there is only one to-do, req.body.todoText will be a single string...
            newNote.todos = [{ todoText: req.body.todoText, todoDue: req.body.todoDue },];
        }
        else { // ...oherwise, it will be an array. In this case, we must iterate over it to add each to-do.
            const todoQty = req.body.todoText.length;

            for (let i = 0; i < todoQty; i++) {
                newNote.todos[i] = {
                    todoText: req.body.todoText[i],
                    todoDue: req.body.todoDue[i]
                }
            }
        }
    }

    try {
        await newNote.save();
        res.redirect("/");
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Error saving note")
    }
});

app.get('/search', async (req, res) => {
    if (!req.query.query) {
        return res.status(400).send('Query parameter is required');
    }

    try {
        const query = req.query.query; // This explicitly fetches the 'query' parameter from the request URL
        const searchResults = await Note.find({
            title: { $regex: new RegExp(query, 'i') }
        }).limit(5);
        res.json(searchResults);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).send('Error performing search');
    }
});

app.get("/notes/:noteId", async (req, res) => {
    try {
        const note = await Note.findOne({ _id: req.params.noteId });
        if (note) {
            res.render("note", {
                id: note._id,
                title: note.title,
                description: note.description,
                todos: note.todos
            })
        }
        else {
            res.status(404).send("Not found");
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching note");
    }
})

app.post("/notes/:noteId/delete", async (req, res) => {
    try {
        const note = await Note.findByIdAndDelete(req.params.noteId);
        res.redirect("/");
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Error deleting note");
    }
});

app.post("/notes/:noteId/addTodos", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (req.body.todoText) {
            if (typeof req.body.todoText == "string") { // If there is only one to-do, req.body.todoText will be a single string...
                note.todos.push({ todoText: req.body.todoText, todoDue: req.body.todoDue });
            }
            else { // ...oherwise, it will be an array.
                const todoQty = req.body.todoText.length;
                for (let i = 0; i < todoQty; i++) {
                    note.todos.push({
                        todoText: req.body.todoText[i],
                        todoDue: req.body.todoDue[i]
                    });
                }
            }
            await note.save();
        }
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding to-dos to note");
    }
    res.redirect('back');
});

app.post("/notes/:noteId/deleteTodo/:index", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);

        note.todos.splice(req.params.index, 1);

        await note.save();
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting to-do in note");
    }
    res.redirect('back');
});

app.post("/notes/:noteId/toggleTodo/:index", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);

        note.todos[req.params.index].todoCompleted = req.body.check;

        await note.save();
    } catch (err) {
        console.error(err);
        res.status(500).send("Error toggling to-do in note");
    }
    res.send(undefined);
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost/${port}`);
});