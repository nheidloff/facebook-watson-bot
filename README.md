Chatbot for Facebook that leverages IBM Watson
================================================================================

The [facebook-watson-bot](https://github.com/nheidloff/facebook-watson-bot) project contains sample code that shows how to build a chatbot for Facebook that leverages [IBM Watson Dialog](http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/dialog.html) and [IBM Watson Natural Language Classifier](http://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/nl-classifier.html) for conversations with users. The bot has been implemented via Node.js and is hosted on [IBM Bluemix](https://bluemix.net).

The sample bot shows recent tweets with a positive or negative sentiment about a specific topic via the [Insights for Twitter](https://console.ng.bluemix.net/catalog/services/insights-for-twitter) service. Check out the [screenshots](https://github.com/nheidloff/facebook-watson-bot/tree/master/screenshots) folder for more information.

The left screenshot shows the usage of the Dialog service, the right column shows additionally the Natural Language Classifier.

![alt text](https://raw.githubusercontent.com/nheidloff/facebook-watson-bot/master/screenshots/facebookbot5.png "Buzz Bot for Facebook")

Author: Niklas Heidloff [@nheidloff](http://twitter.com/nheidloff)


Prerequisites
================================================================================

In order to run this sample you need a Bluemix account. [Sign up](https://console.ng.bluemix.net/registration/) if you don't have an account yet.

Make sure the following tools are installed and on your path.

* [node](https://nodejs.org/download/release/v4.2.6/) and npm (it's adviced to use v4.2.6 which is the latest supported version on Bluemix)
* [git](https://git-scm.com/downloads)
* [cf](https://github.com/cloudfoundry/cli#downloads)

You need to create a Facebook app, a Facebook page, setup a webhook, define a verification secret and get an access token. Follow the [Facebook Messenger Platform Getting Started](https://developers.facebook.com/docs/messenger-platform/quickstart) documentation for details.


Setup of the Application on Bluemix
================================================================================

Invoke the following commands to create the service and deploy the application to Bluemix. This will allow you to do local changes and then push updates.

```sh
$ cf login -a api.ng.bluemix.net
$ cf create-service dialog standard dialog-service
$ cf create-service natural_language_classifier standard natural_language_classifier
$ git clone https://github.com/nheidloff/facebook-watson-bot.git
$ cd facebook-watson-bot
$ npm install
$ cf push
```

You now have your own instance up and running on Bluemix. The name of the application is "buzzbot". You can find the URL in the command window, for example "buzzbot-random-word.mybluemix.net".

After you've done the initial 'cf push' you should change manifest.yml and replace ${random-word} with your route. Otherwise new routes will be added the next time you invoke 'cf push'.


Setup of the Natural Language Classifier Service
================================================================================

In order to configure the Watson Natural Language Classifier invoke the follwing command. You can get your Watson credentials from the dashboard of this service in Bluemix.

```sh
curl -i -u "<username>":"<password>" -F training_data=@./nlc-training.csv -F training_metadata="{\"language\":\"en\",\"name\":\"PosNegClassifier\"}" "https://gateway.watsonplatform.net/natural-language-classifier/api/v1/classifiers"
```

Copy and paste the classifier id in dialog.xml ([row 36](https://github.com/nheidloff/facebook-watson-bot/blob/master/dialog.xml#L36)).


Setup of the Dialog Service
================================================================================

In order to configure the Watson Dialog service, deploy the [Dialog Tool](https://github.com/watson-developer-cloud/dialog-tool) on Bluemix and open the application. The tool allows you to upload the dialog definition which you find in the file dialog.xml. After this you can test the dialog in the web user interface. The web application also shows the dialog id of your uploaded and deployed dialog. Copy and paste this dialog id into app.js or set it as environment variable 'DIALOG_ID' in your Bluemix application. 

As alternative to the dialog tool you can also invoke a [curl command](https://www.ibm.com/smarterplanet/us/en/ibmwatson/developercloud/dialog/api/v1/?curl#create-dialog).


Setup of the Facebook Bot
================================================================================

Follow the [Facebook Messenger Platform Getting Started](https://developers.facebook.com/docs/messenger-platform/quickstart) instructions for how to verify the callback and how to get an access token.

Copy and paste the access token from Facebook and the secret you chose in app.js or in the Bluemix environment variables 'TOKEN' and 'SECRET'. After this push the application again.

In order to set up the welcome message of the bot run the curl command defined in setupbot.txt.

To run the bot open your new page in Facebook and click on 'Message'.


Limitations
================================================================================

Note that this is just a simple sample and not intended for production usage. The Facebook Messenger Platform is only available as beta. I couldn't find information yet about state management like when users join and leave conversations. The buttons in messages also don't seem to work in the Messenger apps yet.