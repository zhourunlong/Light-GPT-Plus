# Light-GPT Plus

Light-GPT Plus is built on [Light-GPT](https://github.com/riwigefi/light-gpt).
It offers more necessary features, similar to ChatGPT, while fixing bugs of the original Light-GPT and removing unnecessary features.
The functionality is Plus, while being "Plus"ly light-weight.

## Added Features
- Model select
  - On the top left corner, there is a drop down box to select models. Now support `GPT-4 Turbo`, `GPT-4` and `GPT-3.5 Turbo`.
- Conversations
  - Now the topic names of conversations are summarizations of the first user message as in ChatGPT, instead of simply the first 10 or so letters of the user message as in the original Light-GPT.
  - [TODO] Support of clearing all conversations.
- Text input
  - [TODO] Support of editing user messages.

## Bug Fixes
### Serious
- System message
  - In the original Light-GPT, the system message (named `systemRoles`) was never actually sent to OpenAI api. Now this bug is fixed.
- Conversation display
  - [TODO] In the original Light-GPT, reopening the topic tab after multiple regeneration displayed all the assistant messages.
### Small
- Text input
  - In the original Light-GPT, deleting the lengthy input text will not shrink the text input area. Now this bug is fixed.

## Removed Features
- Avatars
  - Change the original avatars to ones that are more theme-consistent.
  - Remove the support for changing avatars.
- Context window
  - Remove the limit of (changable) context window (named `chatBackgroundContext`) as it is not used in ChatGPT.
- System message
  - [TODO] Change the default system message.
  - Remove the support for customizing the system message (named `systemRoles` in the original Light-GPT).
- Page saving
  - Remove the methods to save the page into pdf and picture.
- Mobile style
  - Remove the support for mobiles.
- Text input
  - Remove the support to send text by pressing <kbd>Enter</kbd>.
- Toastify JS
  - Remove Toastify JS notifications.
