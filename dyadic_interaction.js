/******************************************************************************/
/*** Preamble ************************************************/
/******************************************************************************/

/*
This experiment covers the Combined condition of Kanwal et al. (2017), i.e. dyadic
interaction with production effort depending on label length.
The experiment features two main phases - observation (training) and then interaction,
where interaction involves label seelction trials (see an object, select a label),
object selection trials (see your partner's label, select an object), and feedback
(find out if you and your partner communicated succesfully or not).

The observation trials are based on the code from word_learning.js, covered earlier
in the course.
Production: object plus two labels, select label, confirm label choice to center cursor.
*/

/******************************************************************************/
/*** Setting the port number for communicating with the server ****************/
/******************************************************************************/

/*
my_port_number is a variable containing the port number to connect to the server
over - we can potentially have multiple servers running on different ports. Using
port 9001 will connect you to the shared server that Kenny is running on
jspsychlearning - so if another person is already in the waiting room you will be
paired with them! If you want to use your own server, change the port number here
and also near the end of dyadic_interaction_server.py - you can request a private 
port number from Kenny if you want to try this.
*/
var my_port_number = 9002;

/******************************************************************************/
/*** Generate a random participant ID *****************************************/
/******************************************************************************/

/*
We'll generate a random participant ID when the experiment starts, and use this
to save a seperate set of data files per participant.
*/

var participant_id = jsPsych.randomization.randomID(10);

/******************************************************************************/
/*** Saving data trial by trial ***********************************************/
/******************************************************************************/

function save_data(name, data_in) {
  var url = "save_data.php";
  var data_to_send = { filename: name, filedata: data_in };
  fetch(url, {
    method: "POST",
    body: JSON.stringify(data_to_send),
    headers: new Headers({
      "Content-Type": "application/json",
    }),
  });
}

/*
Data is saved to a file named di_ID.csv, where di stands for dyadic interaction and ID is
the randomly-generated participant ID.
*/
function save_dyadic_interaction_data(data) {
  // choose the data we want to save - this will also determine the order of the columns
  var data_to_save = [
    participant_id,
    data.trial_index,
    data.trial_type,
    data.time_elapsed,
    data.partner_id,
    data.stimulus,
    data.observation_label,
    data.button_choices,
    data.button_selected,
    data.rt,
  ];

  // join these with commas and add a newline
  var line = data_to_save.join(",") + "\n";
  var this_participant_filename = "di_" + participant_id + ".csv";
  save_data(this_participant_filename, line);
}

var write_headers = {
  type: "call-function",
  func: function () {
    var this_participant_filename = "di_" + participant_id + ".csv";
    save_data(
      this_participant_filename,
      "participant_id,trial_index,trial_type,time_elapsed,\
      partner_id,stimulus,observation_label,button1,button2,button_selected,rt\n"
    );
  },
};

/******************************************************************************/
/*** Observation trials ************************************************/
/******************************************************************************/

/*
This is based heavily on the equivalent code in word_learning.js

make_observation_trial is a function that takes two arguments - an object name
(a string giving the name of a jpg file in the images folder) and a label to pair
it with.

Each observation trial consists of two trials: the initial presentation of the
object (for 1000ms) and then the object plus label (in the prompt) for 2000ms.
*/

function make_observation_trial(object, label) {
  var object_filename = "images/" + object + ".jpg"; //build file name for the object
  trial = {
    type: "image-button-response",
    stimulus: object_filename,
    choices: [],
    timeline: [
      {
        prompt: "&nbsp;", //dummy text
        trial_duration: 1000,
      },
      {
        prompt: label,
        trial_duration: 2000,
        post_trial_gap: 500,
        data: { trial_type: "observation", observation_label: label },
        on_finish: function (data) {
          save_dyadic_interaction_data(data);
        },
      },
    ],
  };
  return trial;
}

/*
Now we can use this function to make some observation trials - object4 paired with
two non-word labels, buv and cal.
*/
var observation_trial_obj4_long = make_observation_trial("object4", "zopekil");
var observation_trial_obj4_short = make_observation_trial("object4", "zop");
var observation_trial_obj5_long = make_observation_trial("object5", "zopudon");
var observation_trial_obj5_short = make_observation_trial("object5", "zop");

/*
Repeat and then shuffle to produce our observation trials - note that object 4 is
3 times as frequent as object 5, but both objects occur equally frequently with their
short and long labels.
*/

var observation_trials = jsPsych.randomization.repeat(
  [
    observation_trial_obj4_long,
    observation_trial_obj4_short,
    observation_trial_obj5_long,
    observation_trial_obj5_short,
  ],
  [6, 6, 2, 2]
);

/******************************************************************************/
/******************************************************************************/
/*** Interaction **************************************************************/
/******************************************************************************/
/******************************************************************************/

/******************************************************************************/
/*** The interaction loop *****************************************************/
/******************************************************************************/

/*
call-function is a simple jspsych plugin which executes a single function - it has
no visible effect for the participant, but behind the scenes it launches our
interaction_loop function, which connects the browser to a python server running
on jspsychks and listens for instructions. There is more detail below on what those
instructions are - the code for the interaction_loop function is also in
dyadic_interaction_utilities.js if you are curious. We will add this trial to the
timeline, after the observation phase, and it will launch us into the dyadic
interaction part of the experiment.
*/
var start_interaction_loop = { type: "call-function", func: interaction_loop };

/******************************************************************************/
/*** Instructions from the server *********************************************/
/******************************************************************************/

/*
There is another program running on the jspsychks server, written in python,
which handles the interaction phase for us - it listens for client web browsers to
connect, then when they do sends them instructions on what kind of trial to run
(e.g. a waiting message, a director trial, a matcher trial, etc) and takes actions
based on messages the clients send back (e.g. once the participant completes a
director trial they will send some information to the python server telling it
what label they selected, and the python server will use that to build a matcher
trial for the matcher).

All of the code for handling these messages is in dyadic_interaction_utilities - it's
not actually very complicated, but for our purposes all you have to know is that the
server will instruct us to run one of 8 functions, which create particular trials and
add them to the timeline - we add that trial to the timeline, allow the timeline to run,
then pause the timeline until we receive another instruction from the python server.

The functions we will be asked to execute are:

waiting_room() - a simple function which creates an html-button-response trial
to inform the participant they are in the waiting room, waiting to be paired with
a partner.

waiting_for_partner() - creates an html-button-response trial to inform the
participant that they are waiting for their partner (because the partner
is reading instructions, picking a label, etc).

For waiting-room and waiting-for-partner trials, we don't know how long the
participant has to wait. These trials therefore have no set duration and can't be
ended by the participant! This allows them to wait indefinitely (in a real experiment
you'd want a way for them to signal they have had enough of waiting, but in the
interests of simplicity I haven't added that here). But we have to have a way of
kicking a participant out of one of these never-ending wait trials so we can actually
allow them to progress through the experiment once their waiting time is over.
We do this via another function, end_waiting(), which is triggered whenever we have
a new trial to run - end_waiting() checks if the participant is currently in an
infinite-wait trial, and if so ends that trial, which allows the experiment
to progress. You will see end_waiting() dotted about in the code, that's what it's
for, and we run it whenever we think the participant might just have been in an
infinte-wait trial.

show_interaction_instructions() - creates an html-button-response trial
to inform the participant that they have been paired and are ready to start interacting.

partner_dropout() - creates a message informing the participant that something has
gone wrong, then redirects them to the end of the experiment. For multi-player experiments you
always need a procedure for handling participant dropout, otherwise you will get
a lot of irrate emails!

end_experiment() - creates the final info screen, and then when the participant
completes this trial, ends the entire timeline.

director_trial(target_object,partner_id) - this creates and runs a single director
trial, where the director is presented with target_object and selects a label to
send to partner_id. This info is then relayed back to the server, which will construct
a matcher trial (see below). Most of the code for the director_trial function is
the same as the production trials in word_learning.js.

matcher_trial(label,partner_id) - this creates and runs a single matcher
trial, where the director is presented with label and selects an object, their
guess about the object partner_id was labelling. This jhoice is then relayed back
to the server, which figures out whether the communication was a success or
failure and generates some feedback for both participants. Most of the code for
the matcher_trial function is the same as the picture selection trials in
perceptual_learning.js.

display_feedback(score) - creates a simple text screen informing the participant
whether the communication was succesful (score=1) or unsuccesful (score=0).

Some of these functions use send_to_server to send a message back to the server - these
messages are one of a limited number that the server knows how to interpret, and can
sometimes include information based on the participant's response, e.g. what label
or object they selected. send_to_server is defined in dyadic_interaction_utilities.js.

Each of these functions is detailed below.
*/

/******************************************************************************/
/*** Waiting room **********************************************************/
/******************************************************************************/

/*
Builds a trial which informs the participant they are in the waiting room, adds
that trial to the timeline (using jsPsych.addNodeToEndOfTimeline), and then
instructs the experiment to resume - then once the trial is finished (on_finish)
we pause the experiment again. We use this technique throughout - add a trial to the
timeline, allow that trial to run, and then pause the experiment when it finishes,
to await further instructions from the python server.
*/

function waiting_room() {
  var waiting_room_trial = {
    type: "html-button-response",
    stimulus: "You are in the waiting room",
    choices: [],
    on_finish: function () {
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(waiting_room_trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Waiting for partner ******************************************************/
/******************************************************************************/

/*
A simple waiting message trial - note the same structure, we create the trial, add
it to the timeline, run the timeline, and then pause the experiment after the trial
has run.

NB we run end_waiting() here too, just in case the participant was already waiting
when the server told them to wait!
*/
function waiting_for_partner() {
  end_waiting(); //end any current waiting trial
  var waiting_trial = {
    type: "html-button-response",
    stimulus: "Waiting for partner",
    choices: [],
    on_finish: function () {
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(waiting_trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Ending infinite wait trials **********************************************/
/******************************************************************************/

/*
This ends the current trial *if* it's an infinite-wait trial. We access the current
trial using jsPsych.currentTrial(), and identify waiting trials by looking at the
trial.stimulus - if the current trial is a waiting trial, we end it with jsPsych.finishTrial(),
another built-in function.
*/
function end_waiting() {
  if (
    jsPsych.currentTrial().stimulus == "Waiting for partner" ||
    jsPsych.currentTrial().stimulus == "You are in the waiting room"
  ) {
    jsPsych.finishTrial();
  }
}

/******************************************************************************/
/*** Instructions after being paired ******************************************/
/******************************************************************************/

/*
Participants receiving this command will be stuck on the never-ending waiting
room trial, so need to break them out of that trial with end_waiting(), then give
them their instructions.

Once the participant has read the instructions we use send_to_server to let the
server know we are done, by sending a specifically-formatted message which the server
knows how to interpret, then pause and wait for more instructions.
*/
function show_interaction_instructions() {
  end_waiting();
  var instruction_screen_interaction = {
    type: "html-button-response",
    stimulus:
      "<h3>Pre-interaction Instructions</h3>\
                                                  <p style='text-align:left'>Instructions for the interaction stage.</p>",
    choices: ["Continue"],
    on_finish: function () {
      send_to_server({ response_type: "INTERACTION_INSTRUCTIONS_COMPLETE" });
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(instruction_screen_interaction);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Instructions when partner drops out **************************************/
/******************************************************************************/

/*
Creates a trial informing the participant that there is a problem, and then adds
this trial to the timeline then calls end_experiment() to also add the final info
screen.
*/
function partner_dropout() {
  end_waiting();
  var stranded_screen = {
    type: "html-button-response",
    stimulus:
      "<h3>Oh no, something has gone wrong!</h3>\
                                    <p style='text-align:left'>Unfortunately it looks like something has gone wrong - sorry!</p>\
                                    <p style='text-align:left'>Clock continue to progress to the final screen and finish the experiment.</p>",
    choices: ["Continue"],
  };
  jsPsych.addNodeToEndOfTimeline(stranded_screen);
  end_experiment();
}

/******************************************************************************/
/*** End-of-experiment screen *************************************************/
/******************************************************************************/

/*
The final information screen. In this trial's on_finish we close the connection
to the python server using close_socket(), then end the entire timeline, using
jsPsych.endCurrentTimeline(), just in case there are any other lurking trials
that haven't been run yet (which can happen e.g. if the participant's partner drops
out mid-turn).
*/
function end_experiment() {
  var final_screen = {
    type: "html-button-response",
    stimulus:
      "<h3>Finished!</h3>\
                                 <p style='text-align:left'>Experiments often end \
                                 with a final screen, e.g. that contains a completion \
                                 code so the participant can claim their payment.</p>\
                                 <p style='text-align:left'>This is a placeholder for that information.</p>",
    choices: ["Continue"],
    on_finish: function () {
      close_socket();
      jsPsych.endCurrentTimeline();
    },
  };
  jsPsych.addNodeToEndOfTimeline(final_screen);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Director (label selection) trials ****************************************/
/******************************************************************************/

/*
This is based on the equivalent code in word_learning.js

director_trial is a function that takes two arguments - an object name ("object4"
or "object5") and then the unique ID of the participant's partner - we just pass
the partner ID in so you can figure out who was talking to who when you look at
your data files!

Each production trial consists of three sub-trials: the initial presentation of the
object, then the object plus label choices presented as buttons (with order shuffled),
then a third trial where the participant clicks again on the label they selected on the
second trial.

Most of the details here are as in word_learning.js, but we add our manipulation
of production effort at this third stage. Kanwal et al. had participants click and hold,
with a longer hold required for the longer label. In the interests of simplicity
(there are other bits of complexity in this code!) I have implemented a slightly
different way of increasing production effort - multiple clicks are required to
send the label, one per label character. I am doing this using a loop, like we used 
in the iterated learning experimnet to allow participants to click multiple times 
to build a label, but here they just have to click a set number of times on a single button. 
We look up which label the participant selected on subtrial 2 - in the same way as we did 
back in word_learning.js - but then look at the length of that label, and require the 
participant to produce that many clicks in the loop to finish the trial. We keep track of
which label they selected, how many clicks are required, and how many they have given in 
three variables, label_selected, n_clicks_required, and n_clicks_given, which allow us 
to control the behaviour of this loop.

Then after this 3rd subtrial, we send a message to the server using a call-function trial, 
letting it know (among other info) which label the participant selected - the server can then
relay this on to the other participant.
*/

function director_trial(target_object, partner_id) {
  end_waiting();
  //label choices depend on the object - need to hard-wire this is *somewhere*,
  //here seems as good a place as any
  if (target_object == "object4") {
    label_choices = ["zop", "zopekil"];
  } else if (target_object == "object5") {
    label_choices = ["zop", "zopudon"];
  }
  //bit of book-keeping on object filename
  var object_filename = "images/" + target_object + ".jpg";

  //some variables to help us keep track of the loop for repeated clicking
  var label_selected; //to be filled in later
  var n_clicks_required; //to be filled in later
  var n_clicks_given = 0;

  //subtrial 1 - just show the object
  var subtrial1 = {
    type: "image-button-response",
    stimulus: object_filename,
    prompt: "&nbsp;", //placeholder prompt
    choices: label_choices, //these buttons are invisible and unclickable!
    button_html:
      '<button style="visibility: hidden;" class="jspsych-btn">%choice%</button>',
    response_ends_trial: false,
    trial_duration: 1000,
  };
  //subtrial 2: show the two labelled buttons and have the participant select
  var subtrial2 = {
    type: "image-button-response",
    stimulus: object_filename,
    prompt: "&nbsp;", //placeholder prompt
    choices: [],
    //at the start of the trial, randomise the left-right order of the labels
    //and note that randomisation in data
    on_start: function (trial) {
      var shuffled_label_choices = jsPsych.randomization.shuffle(label_choices);
      trial.choices = shuffled_label_choices;
      trial.data = {
        block: "production",
        button_choices: shuffled_label_choices,
      };
    },
    //at the end, use data.response to figure out
    //which label they selected, and add that to data and save to server
    on_finish: function (data) {
      var button_number = data.response;
      var label_pressed = data.button_choices[button_number];
      data.button_selected = label_pressed;
      label_selected = label_pressed; //keep track of this in our variable
      n_clicks_required = label_selected.length; //this determines how many times we click in the loop
      data.trial_type = "director";
      data.partner_id = partner_id; //add this to data so it is saved to data file
      save_dyadic_interaction_data(data);
    },
  };
  //subtrial 3: this is where we make the participant do a specified number of clicks
  //first we define what a single clicking trial looks like
  var single_click_trial = {
    type: "image-button-response",
    stimulus: object_filename,
    prompt: "",
    choices: [],
    on_start: function (trial) {
      //get the label selected on subtrial 2 from the variable label_selected
      trial.choices = [label_selected]; //this is your only choice
      //n_clicks_required tells you how many times to click
      trial.prompt = "Click " + n_clicks_required + " times to send!";
    },
    //once we have clicked, increment the click counter
    on_finish: function () {
      n_clicks_given += 1;
    },
  };
  //now we can set up the loop
  var subtrial3 = {
    timeline: [single_click_trial],
    loop_function: function () {
      //keep looping until n_clicks_given = n_clicks_required
      if (n_clicks_given < n_clicks_required) {
        return true;
      } else {
        return false;
      }
    },
  };
  //finally, let the server know what we did
  var message_to_server = {
    type: "call-function",
    func: function () {
      //let the server know what label the participant selected,
      //and some other info that makes the server's life easier
      send_to_server({
        response_type: "RESPONSE",
        participant: participant_id,
        partner: partner_id,
        role: "Director",
        target_object: target_object,
        response: label_selected,
      });
      jsPsych.pauseExperiment();
    },
  };
  //put the three sub-parts plus the message-send together in a single complex trial
  var trial = {
    timeline: [subtrial1, subtrial2, subtrial3, message_to_server],
  };
  jsPsych.addNodeToEndOfTimeline(trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Matcher (object selection) trials ****************************************/
/******************************************************************************/

/*
This is based on the picture selection trial code in perceptual_learning.js. The
only addition is the send_to_server command at the end, to relay back to the server
which object the matcher selected.
*/

function matcher_trial(label, partner_id) {
  end_waiting();
  //possible object choices are hard-wired here
  var object_choices = ["object4", "object5"];
  var trial = {
    type: "html-button-response",
    stimulus: label,
    choices: object_choices,
    button_html:
      '<button class="jspsych-btn"> <img src="images/%choice%.jpg"></button>',

    on_start: function (trial) {
      var shuffled_object_choices = jsPsych.randomization.shuffle(
        trial.choices
      );
      trial.choices = shuffled_object_choices;
      trial.data = { button_choices: shuffled_object_choices };
    },
    on_finish: function (data) {
      var button_number = data.response;
      data.trial_type = "matcher";
      data.button_selected = data.button_choices[button_number];
      data.partner_id = partner_id; //add this to data so it is saved to data file
      save_dyadic_interaction_data(data);
      send_to_server({
        response_type: "RESPONSE",
        participant: participant_id,
        partner: partner_id,
        role: "Matcher",
        director_label: label,
        response: data.button_selected,
      });
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/*** Feedback trials **********************************************************/
/******************************************************************************/

/*
A simple message informing the participant whether the communication was successful
or not.
*/
function display_feedback(score) {
  end_waiting();
  if (score == 1) {
    var feedback_stim = "Correct!";
  } else {
    var feedback_stim = "Incorrect!";
  }
  var feedback_trial = {
    type: "html-button-response",
    stimulus: feedback_stim,
    choices: [],
    trial_duration: 1500,
    on_finish: function () {
      send_to_server({ response_type: "FINISHED_FEEDBACK" });
      jsPsych.pauseExperiment();
    },
  };
  jsPsych.addNodeToEndOfTimeline(feedback_trial);
  jsPsych.resumeExperiment();
}

/******************************************************************************/
/******************************************************************************/
/*** Build and run the timeline ***********************************************/
/******************************************************************************/
/******************************************************************************/

/******************************************************************************/
/*** Instruction trials *******************************************************/
/******************************************************************************/

/*
As usual, your experiment will need some instruction screens - here, these are
the instruction screens leading up to the interaction loop.
*/

var consent_screen = {
  type: "html-button-response",
  stimulus:
    "<h3>Welcome to the experiment</h3> \
  <p style='text-align:left'>Experiments begin with an information sheet that explains to the participant \
  what they will be doing, how their data will be used, and how they will be \
  remunerated.</p> \
  <p style='text-align:left'>This is a placeholder for that information, which is normally reviewed \
  as part of the ethical review process.</p>",
  choices: ["Yes, I consent to participate"],
};

var instruction_screen_observation = {
  type: "html-button-response",
  stimulus:
    "<h3>Observation Instructions</h3>\
  <p style='text-align:left'>Instructions for the observation stage.</p>",
  choices: ["Continue"],
};

var instruction_screen_enter_waiting_room = {
  type: "html-button-response",
  stimulus:
    "<h3>Instructions before entering the waiting room</h3>\
  <p style='text-align:left'>Once the participant clicks through here they will connect to the server \
  and the code will try to pair them with another participant.</p>",
  choices: ["Continue"],
};

var preload_trial = {
  type: "preload",
  auto_preload: true,
};

/******************************************************************************/
/*** Build the timeline *******************************************************/
/******************************************************************************/

/*
Note that this timeline only takes us as far as the interaction loop, at which point
the rest of the trials will be added dynamically.
*/
var full_timeline = [].concat(
  consent_screen,
  preload_trial,
  write_headers,
  instruction_screen_observation,
  observation_trials,
  instruction_screen_enter_waiting_room,
  start_interaction_loop
);

/******************************************************************************/
/*** Run the timeline *******************************************************/
/******************************************************************************/

/*
Run the timeline
*/
jsPsych.init({
  timeline: full_timeline,
});
