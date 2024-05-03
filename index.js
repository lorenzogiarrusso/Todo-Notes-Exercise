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

//Port number used on local host
const port = 3000;

const todoSchema = new mongoose.Schema({
    todoText: { type: String, required: true }, //To-do's description
    todoDue: { type: Date, required: true }, //Date before which the to-do should be completed
    todoCompleted: { type: Boolean, default: false } //Boolean indicating whether the to-do has been completed
});

const noteSchema = new mongoose.Schema({
    title: { type: String, required: true }, //Note title
    description: String, //Note description
    todos: [todoSchema] //Array of to-dos belonging to the note
});

const Note = mongoose.model("Note", noteSchema);

//GET homepage
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

//GET webpage to create a new note
app.get("/compose", (req, res) => {
    res.render("compose.ejs");
});

//POST received when the user creates a new note through the compose webpage
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
        res.redirect("/"); //Redirect to homepage
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Error saving note")
    }
});

//Used for search bar functionality
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

//GET webpage with details on a specific note based on its id
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

//POST used to delete a note specified through its id. Used when the user click on "Delete note" in the /notes/:noteId webpage
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

//POST used to add new todos to an existing node specified through its id. Used when the user submits new to-dos through the /notes/:noteId webpage
app.post("/notes/:noteId/addTodos", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);
        if (req.body.todoText) {
            if (typeof req.body.todoText == "string") { // If there is only one to-do, req.body.todoText will be a single string, so we simply push it onto the note.todos array
                note.todos.push({ todoText: req.body.todoText, todoDue: req.body.todoDue });
            }
            else { // ...oherwise, it will be an array. In this case, we iterate over it and push elements onto the note.todos array
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

//POST used to delete a specific to-do from an existing note. Used when the user clicks on a "Delete to-do" button in the /notes/noteId webpage
//:index is the to-do's position in the note's todos array.
app.post("/notes/:noteId/deleteTodo/:index", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);

        note.todos.splice(req.params.index, 1); //remove to-do from the note.todos array based on its index in the array

        await note.save();
    } catch (err) {
        console.error(err);
        res.status(500).send("Error deleting to-do in note");
    }
    res.redirect('back');
});

//POST used to toggle the "completed" state of a to-do belonging to a note. Used when the user clicks on a to-do checkbox in the notes/:noteId webpage.
//req.body.check contains the boolean value to be assigned to the to-do's todoCompleted field. The change is applied to the database.
app.post("/notes/:noteId/toggleTodo/:index", async (req, res) => {
    try {
        const note = await Note.findById(req.params.noteId);

        note.todos[req.params.index].todoCompleted = req.body.check;

        await note.save();
    } catch (err) {
        console.error(err);
        res.status(500).send("Error toggling to-do in note");
    }
    res.send(undefined); //There is no need to send back anything as this function merely updates the database
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost/${port}`);
});