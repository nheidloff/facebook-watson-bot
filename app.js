//------------------------------------------------------------------------------
// Copyright IBM Corp. 2016
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------

var cfenv = require("cfenv");
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var watson = require('watson-developer-cloud');
var extend = require('util')._extend;

var watsonDialogCredentials =  extend({
  // used when running locally
  url: 'https://gateway.watsonplatform.net/dialog/api',
  username: 'xxx',
  password: 'xxx',
  version: 'v1'
}, getServiceCredentialsFromBluemix('dialog')); 

var watsonNLCCredentials =  extend({
  // used when running locally
  url: 'https://gateway.watsonplatform.net/natural-language-classifier/api',
  username: 'xxx',
  password: 'xxx',
  version: 'v1'
}, getServiceCredentialsFromBluemix('natural_language_classifier')); 

// define dialog id here when running locally. when running on Bluemix set an environment variable
var dialog_id = process.env.DIALOG_ID || 'ebca53c9-6e15-4b5a-b440-8e795efc2d1f';

// replace these values with your values from Facebook or set them in Bluemix environment variables
var token = process.env.TOKEN || "xxx";
var secret = process.env.SECRET || 'secret';

var appEnv = cfenv.getAppEnv();
var app = express();
app.use(bodyParser.json())

app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === secret) {
    res.send(req.query['hub.challenge']);
  }
  res.send('Error, wrong validation token');
});

var dialog = watson.dialog(watsonDialogCredentials);
var natural_language_classifier = watson.natural_language_classifier(watsonNLCCredentials);
var conversation_id;
var client_id;

// 'senders' stores state about the user sessions and conversations
// in a production level bot this should be handled differently
// I couldn't find in the Facebook Messenger Platform (beta) documentation 
// whether state information can be sent with messages and I couldn't find
// information about users joining and leaving conversations
var senders = {};

app.get('/', function (req, res) {
  res.send('up');
});

function sendTextMessage(recipient, text) {  
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:recipient},
      message: {
        text:text
      }
    }
  }, 
  function(error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

function sendButtonMessage(recipient, text, buttons) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:recipient},
      message: {
        "attachment":{
          "type":"template",
          "payload":{
            "template_type":"button",
            "text":text,
            "buttons": buttons
          }
        }
      }
    }
  }, 
  function(error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

function sendGenericTemplateMessageWithTweets(recipient, author, imageUrl, title, url) {
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:recipient},
      message: {
        "attachment":{
          "type":"template",
          "payload":{
            "template_type":"generic",
            "elements": [
              {
                "title":author,
                "image_url":imageUrl,
                "subtitle":title,
                "buttons":[
                  {
                    "type":"web_url",
                    "url":url,
                    "title":"View Tweet"
                  }           
                ]
              }
            ]
          }
        }
      }         
    }
  }, 
  function(error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error: ', response.body.error);
    }
  });
}

function showTweets(recipient, topic, sentiment) {
  request({
    url: 'http://insights-search.mybluemix.net/api/1/messages/search?q='+ 
      topic + '%20AND%20posted%3A2016-05-01%20AND%20sentiment%3A' + sentiment,
    qs: {access_token:token},
    method: 'GET'
  }, 
  function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var output = JSON.parse(body);
      if (output.tweets && output.tweets.length > 2) {
        for (i = 0; i < 3; i++) { 
          sendGenericTemplateMessageWithTweets(recipient, 
            output.tweets[i].message.actor.displayName,
            output.tweets[i].message.actor.image,
            output.tweets[i].message.body,
            output.tweets[i].message.link
            )
        }
      }
    }
  });
}

function processDialogResponse(results, sender) {
  if (results && results.response && results.response[0]) {
    var returnMessage;
    var command;
    var details;
    var classifier_id;
    var responseText = results.response[0];

    // examples from dialog.xml:
    // <item>Hi, I'll show you the latest buzz around a topic of your choice. What topic are you interested in?</item>
    // <item>Alright. Here are the {Sentiment} tweets about {Topic}:$ExecCode$showTweets(sender, "{Topic}", "{Sentiment}")</item>
    // <item>Are you interested in positive or negative tweets?$ShowButtons$[{"type":"postback","title":"Positive","payload":"positive"},{"type":"postback","title":"Negative","payload":"negative"}]#3a84cfx63-nlc-5285</item>
    if (responseText.indexOf('#') > -1) {
      classifier_id = responseText.substring(responseText.indexOf('#') + 1, responseText.length);
      responseText = responseText.substring(0, responseText.indexOf('#'));
    }

    if (responseText.indexOf('$') > -1) {
      returnMessage = responseText.substring(0, responseText.indexOf('$'));
      command = responseText.substring(responseText.indexOf('$') + 1, responseText.lastIndexOf('$'));
      details = responseText.substring(responseText.lastIndexOf('$') + 1, responseText.length);
    }
    else {
      returnMessage = responseText;
    }

    senders[sender] = { client_id: results.client_id,
                        conversation_id: results.conversation_id,
                        classifier_id: classifier_id}
    
    if (command) {
      switch (command) {
        case 'ShowButtons':
          sendButtonMessage(sender, returnMessage, JSON.parse(details));
          break;
        case 'ExecCode':
          sendTextMessage(sender, returnMessage);
          eval(details);
          break;
        }
      }
      else {
        sendTextMessage(sender, returnMessage);
      }
  }
}

function invokeDialogAndProcessResponse(text, sender) {
  if (text) {
    if (!senders[sender])
      senders[sender] = { client_id: '', conversation_id: '', classifier_id: ''}

    var params = {
      conversation_id: senders[sender].conversation_id,
      dialog_id: dialog_id,
      client_id: senders[sender].client_id,
      input: text
    };
    
    dialog.conversation(params, function(err, results) {
      if (err) {
        console.log(err);
        sendTextMessage(sender, "Error occured in Watson Dialog service");
      }   
      else {
        processDialogResponse(results, sender);
      }
    });   
  }
}

function processEvent(event) { 
  var sender = event.sender.id;
  
  var text;
  if (event.postback && event.postback.payload) {
    text = event.postback.payload;
    // I couldn't find in the Facebook Messenger Platform (beta) webhooks documentation how to receive
    // system messages when users join and leave conversations. for now I use this workaround
    if (text) {
      if (text === 'hi') {
        senders[sender] = { client_id: '', conversation_id: '', classifier_id: ''};
      }
    }
    invokeDialogAndProcessResponse(text, sender);
  } 
  else if (event.message && event.message.text) {
    text = event.message.text;
    var classifier_id = senders[sender].classifier_id;
    if (!classifier_id) {
      invokeDialogAndProcessResponse(text, sender);
    }
    else {
      natural_language_classifier.classify({
        text: text,
        classifier_id: classifier_id},
        function(err, response) {
          if (err) {
            console.log(err);
            sendTextMessage(sender, "Error occured in Watson Natural Language Classifier service");
          }
          else {
            if (response && response.classes && response.classes.length >1) {
              console.log('nik text ' + text);
              console.log('nik conf ' + response.classes[0].confidence);
              console.log('nik class_name ' + response.classes[0].class_name);
              if (response.classes[0].confidence > 0.7) {
                invokeDialogAndProcessResponse(response.classes[0].class_name, sender);
              }
              else {
                invokeDialogAndProcessResponse(text, sender);
              }
            }
            else {
              invokeDialogAndProcessResponse(text, sender);
            }
          }
        });
      }
    }
}

app.post('/webhook/', function (req, res) {
  messaging_events = req.body.entry[0].messaging;
  for (i = 0; i < messaging_events.length; i++) {
    event = req.body.entry[0].messaging[i];
    processEvent(event);
  }
  res.sendStatus(200);
});

function getServiceCredentialsFromBluemix(name) {
  if (process.env.VCAP_SERVICES) {
    var services = JSON.parse(process.env.VCAP_SERVICES);
    for (var service_name in services) {
      if (service_name.indexOf(name) === 0) {
        var service = services[service_name][0];
        return {
          url: service.credentials.url,
          username: service.credentials.username,
          password: service.credentials.password
        };
      }
    }
  }
  return {};
};

app.listen(appEnv.port, appEnv.bind, function() {
  console.log('listening on port ' + appEnv.port);
});