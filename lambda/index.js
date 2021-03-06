// This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
// Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
// session persistence, api calls, and more.
const Alexa = require('ask-sdk-core');
const skillData = require('skillData.js');
const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const sdk = require('@alexa-games/skills-gameon-sdk');
const GameOn = require('./gameOn.js');


const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        const data = getLocalizedData(handlerInput.requestEnvelope.request.locale);
        //debug--Logs : Amazon CloudWatch
        console.log(data);
        //const speakOutput = 'Welcome, to Riddle Me Today. I will give youa Riddle everyday and 3 chances to answer it correctly. The Less chances you take, the more points you win.';
        //best practice due, when client didn't response, we can have reprompt to ask again
        //const prompt = 'Are you ready for today\'s riddle?';
        let speakOutput = " ";
        const prompt = data["QUESTION"];
        
        let persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        console.log(persistentAttributes.FIRST_TIME);
        let dataToSave = {};
        let player = persistentAttributes.PLAYER;
        
        //if the user is coming for the first time or don;t create a player profile the player is undefined
        if(persistentAttributes.FIRST_TIME === undefined && player === undefined){
            //first time user
            //create a player
            player = await GameOn.newPlayer();//due to API call, need to wait the API return
           
            dataToSave = {
                "FIRST_TIME":false,
                "PLAYER": player
            }
            //save into database
            save(handlerInput, dataToSave, null);
            speakOutput = data["WELCOME_MESSAGE"] + data["QUESTION"];
            //getting out and create a new method save() to access the database, also can change the key
            /*
            const attributesManager = handlerInput.attributesManager;
            //set attributes
            attributesManager.setPersistentAttributes(dataToSave);
            //finally save the attributes
            await attributesManager.savePersistentAttributes();
            */
        } else {
            //not first time user, user come back, refresh their session
            player = await GameOn.refreshPlayerSession(player);
            dataToSave = {
                "PLAYER": player
            }
            save(handlerInput, dataToSave, null);
            speakOutput = data["REYURNING_USERS_WELCOME"] + data["QUESTION"];
        }
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(prompt)
            .getResponse();
    }
};

//handlerInput--input you get, attributesToSave--save into database, 
//attributesToDelete things you want to delete form database
//helper method can always use to save and delete form database
function save(handlerInput, attributesToSave, attributesToDelete) {
    return new Promise((resolve, reject) => {
        handlerInput.attributesManager.getPersistentAttributes()
            .then((attributes) => {
                //add to save 
                for (let key in attributesToSave) {
                    attributes[key] = attributesToSave[key];
                }
                //to delete
                if (null !== attributesToDelete) {
                    attributesToDelete.forEach(function (element) {
                        delete attributes[element];
                    });
                }
                handlerInput.attributesManager.setPersistentAttributes(attributes);

                return handlerInput.attributesManager.savePersistentAttributes();
            })
            .catch((error) => {
                reject(error);
            });
    });
}

//globalization 
function getLocalizedData(locale){
    return skillData[locale];
}

const RiddleIntentHandler = {
    canHandle(handlerInput) {
        //we add an AMAZON.YesIntent , attention to the caps!
        return (Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'RiddleIntent') 
            ||(Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Here is the riddle for today. ';
        const data = getLocalizedData(handlerInput.requestEnvelope.request.locale);
        // Homework : Find the number of the current day and get the corresponding questions.
        const speechOutput = speakOutput + data["QUESTIONS"][0];
        //and we save the answer in the dataToSave 
        const dataToSave = {
            "RIGHT_ANSWER":data["ANSWERS"][0]
        }
        //set a session attribute, we record the value when this skill opened.
        handlerInput.attributesManager.setSessionAttributes(dataToSave);
        //reprompt keeps the micro open to get the answer from the user.
        //if the user say somthing alexa do not understand, alexa will speak reprompt
        const reprompt = data["QUESTIONS"][0]+ " "+ data["ANSWER_MESSAGE"];
        return handlerInput.responseBuilder
            .speak(speechOutput)
            .reprompt(reprompt)
            .getResponse();
    }
};

const AnswerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AnswerIntent';
    },
    async handle(handlerInput) {
        const data = getLocalizedData(handlerInput.requestEnvelope.request.locale);
        //capture the user's answer 
        const userAnswer = handlerInput.requestEnvelope.request.intent.slots.answer.resolutions.resolutionsPerAuthority[0].values[0].value.name;
        //const userAnswer = handlerInput.requestEnvelope.request.intent.slots.answer.value;
        //get the session attribute we juest set in the RiddleIntentHandler
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const correctAnswer = sessionAttributes.RIGHT_ANSWER;
        
        let persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        // player = await GameOn.refreshPlayerSession(player);
        let player = persistentAttributes.PLAYER;
        let speakOutput = '';
                
        if(correctAnswer === userAnswer) {
            await GameOn.submitScore(player, 10);
            const playerScore = await GameOn.getPlayerScore(player);
            console.log("Score"+JSON.stringify(playerScore));
            speakOutput = "Correct Answer. You get X points";
            
        } else {
            speakOutput = "Wrong Answer. You only have x chances remaining.";
        }
        

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .withPersistenceAdapter(
        new persistenceAdapter.S3PersistenceAdapter({bucketName: process.env.S3_PERSISTENCE_BUCKET})
    )
    .addRequestHandlers(
        LaunchRequestHandler,
        RiddleIntentHandler,
        AnswerIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
