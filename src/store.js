/* eslint-disable no-unused-vars */
import "firebase/auth";
import "firebase/database";
import "regenerator-runtime/runtime";
import * as firebase from "firebase/app";
import axios from "axios";
import gravatar from "gravatar";
var stripHtml = require("string-strip-html");
import URL from "url-parse";
import uuidv1 from "uuid/v1";
import Vue from "vue";
import VueJsonp from "vue-jsonp";
import Vuex from "vuex";
import vuexI18n from "vuex-i18n"; // i18n the leopard interface
import vueSmoothScroll from "vue-smoothscroll";
import VuePlyr from "vue-plyr";
// const VueShortKey = require("vue-shortkey");
// import longpress from "vue-long-press-directive";
import Listening from "./components/Listening.vue"; // component dialog that shows then capturing audio
import Modal from "./components/Modal.vue";
import Prism from "prismjs";
// import "./plugins/vuetify";
import {
  BallPulseSyncLoader,
  BallScaleRippleMultipleLoader,
  LineScaleLoader,
  LineScalePulseOutRapidLoader
} from "vue-loaders";

import { initializeASR, initializeTTS } from "./utils/asr-tts";

import { STORAGE_KEY } from "./constants/solution-config-default"; // application storage key
import { TRANSLATIONS } from "./constants/translations"; // add UI translations for different language here
import Setup from "./utils/setup";

let config = new Setup();
let store;
Vue.use(VueJsonp, 20000);
Vue.use(Vuex);

Vue.use(VuePlyr);
Vue.use(Prism);
// Vue.use(longpress, { duration: process.env.VUE_APP_LONG_PRESS_LENGTH });

Vue.use(require("vue-shortkey"));
Vue.use(vueSmoothScroll);

Vue.component("teneo-modal", Modal);
Vue.component("teneo-listening", Listening);
Vue.component(LineScaleLoader.name, LineScaleLoader);
Vue.component(LineScalePulseOutRapidLoader.name, LineScalePulseOutRapidLoader);
Vue.component(BallPulseSyncLoader.name, BallPulseSyncLoader);
Vue.component(BallScaleRippleMultipleLoader.name, BallScaleRippleMultipleLoader);

Vue.config.productionTip = false;

export function getStore(callback) {
  config
    .init()
    .then(() => storeSetup(callback))
    .catch(message => console.error(message));
}

function storeSetup(callback) {
  store = new Vuex.Store({
    state: {
      asr: {
        stopAudioCapture: false,
        asr: null
      },
      chatConfig: config.chatConfig,
      activeSolution: config.activeSolution,
      connection: {
        requestParameters: config.REQUEST_PARAMETERS,
        ctxParameters: config.doesParameterExist("teneoCtx") ? JSON.parse(config.getParameterByName("teneoCtx")) : "",
        teneoUrl: config.TENEO_URL
      },
      browser: {
        isMobile: config.mobileDetector.mobile() || config.mobileDetector.tablet() ? true : false,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      auth: {
        firebase: config.firebaseConfig.apiKey ? firebase.initializeApp(config.firebaseConfig) : null,
        userInfo: {
          user: null,
          username: null,
          profileImage: null
        }
      },
      conversation: {
        dialog: [],
        dialogHistory: []
      },
      iframe: {
        iframeUrl: config.IFRAME_URL,
        iframeUrlBase: config.IFRAME_URL
          ? config.IFRAME_URL.substring(0, config.IFRAME_URL.lastIndexOf("/")) + "/"
          : config.IFRAME_URL
      },
      knowledgeData: config.KNOWLEDGE_DATA,
      liveAgent: {
        agentAvatar: null,
        agentID: null,
        agentName: null,
        enableLiveChat: config.ENABLE_LIVE_CHAT,
        isLiveChat: false,
        liveChatMessage: null,
        showLiveChatProcessing: false
      },
      modals: {
        modalItem: null,
        showConfigModal: true,
        showCustomModal: false,
        showModal: false
      },
      progress: {
        listening: false,
        progressBar: false,
        showChatLoading: false
      },
      tts: {
        speakBackResponses: false,
        tts: initializeTTS(config.LOCALE)
      },
      ui: {
        chatTitle: config.CHAT_TITLE,
        dark: localStorage.getItem(STORAGE_KEY + "darkTheme")
          ? localStorage.getItem(STORAGE_KEY + "darkTheme") === "true"
          : false,
        embed: config.EMBED,
        isWebSite: true,
        overlayChat: config.FLOAT,
        responseIcon: config.RESPONSE_ICON,
        theme: config.THEME,
        userIcon: config.USER_ICON,
        showUploadButton: false,
        showChatWindow: false,
        showChatButton: true,
        showButtonOnly: config.SHOW_BUTTON_ONLY,
        chatButtonInitial: !config.getUrlParam("chatopen", false)
      },
      userInput: {
        userInput: "",
        userInputReadyForSending: false
      }
    },
    getters: {
      chatButtonInitial(state) {
        // console.log(`Chat Window Open? : ${!state.ui.chatButtonInitial}`);
        return state.ui.chatButtonInitial;
      },
      uuid(_state) {
        return uuidv1();
      },
      showButtonOnly(state) {
        return state.ui.showButtonOnly;
      },
      timeZoneParam(state) {
        return "&timeZone=" + encodeURI(state.browser.timeZone);
      },
      showChatWindow(state) {
        return state.ui.showChatWindow;
      },
      showChatButton(state) {
        return state.ui.showChatButton;
      },
      uploadConfig(_state, getters) {
        let item = getters.lastReplyItem;
        let uploadConfigJson = null;
        if (getters.itemExtraData(item, "uploadConfig")) {
          uploadConfigJson = getters.itemExtraData(item, "uploadConfig");
        }

        return uploadConfigJson;
      },
      isMobileDevice: state => state.browser.isMobile,
      socialAuthEnabled: state => (state.auth.firebase ? true : false),
      lastReplyItem: state => {
        return state.conversation.dialog
          .slice()
          .reverse()
          .find(item => item.type === "reply");
      },
      userInformationParams(state) {
        let userInfoParams = "";
        if (state.auth.userInfo.user) {
          userInfoParams = `&name=${state.auth.userInfo.user.displayName}&email=${state.auth.userInfo.user.email}`;
        }
        return userInfoParams;
      },
      askingForPassword(_state, getters) {
        let item = getters.lastReplyItem;
        let isAskingForPassword = false;
        if (item && item.teneoResponse) {
          let inputType = decodeURIComponent(item.teneoResponse.extraData.inputType);
          if (inputType !== "undefined" && inputType.trim().toLowerCase() === "password") {
            isAskingForPassword = true;
          }
        }
        return isAskingForPassword;
      },
      inputHelpText(_state, getters) {
        let item = getters.lastReplyItem;
        let inputHelpText;
        if (item && item.teneoResponse) {
          let helpText = decodeURIComponent(item.teneoResponse.extraData.inputHelpText);
          if (helpText !== "undefined") {
            inputHelpText = helpText;
          }
        }
        return inputHelpText;
      },
      itemInputMask(_state, getters) {
        let item = getters.lastReplyItem;
        let itemInputMask;
        if (item && item.teneoResponse) {
          let mask = decodeURIComponent(item.teneoResponse.extraData.inputMask);
          if (mask !== "undefined") {
            itemInputMask = mask;
          }
        }
        return itemInputMask;
      },
      askingForEmail(_state, getters) {
        let item = getters.lastReplyItem;
        let isAskingForEmail = false;
        if (item && item.teneoResponse) {
          let inputType = decodeURIComponent(item.teneoResponse.extraData.inputType);
          if (inputType !== "undefined" && inputType.trim().toLowerCase() === "email") {
            isAskingForEmail = true;
          }
        }
        return isAskingForEmail;
      },
      activeSolution(state) {
        return state.activeSolution;
      },
      listening(state) {
        return state.progress.listening;
      },
      responseIcon(state) {
        return state.ui.responseIcon;
      },
      userIcon(state) {
        return state.auth.userInfo.profileImage ? "account-check" : state.ui.userIcon;
      },
      tts(state) {
        return state.tts.tts;
      },
      asr(state) {
        return state.asr.asr;
      },
      agentAvatar(state) {
        return state.liveAgent.agentAvatar;
      },
      agentId(state) {
        return state.liveAgent.agentID;
      },
      agentName(state) {
        return state.liveAgent.agentName;
      },
      userInputReadyForSending(state) {
        return state.userInput.userInputReadyForSending;
      },
      modalPosition: _state => item => {
        let modalPosition = decodeURIComponent(item.teneoResponse.extraData.modalPosition);
        if (modalPosition !== "undefined") {
          modalPosition = modalPosition.toLowerCase();
        }
        return modalPosition;
      },
      modalSize: _state => item => {
        let modalSize = decodeURIComponent(item.teneoResponse.extraData.modalSize);
        if (modalSize !== "undefined") {
          modalSize = modalSize.toLowerCase();
        }
        return modalSize;
      },
      outputLink: _state => item => {
        return decodeURIComponent(item.teneoResponse.link.href);
      },
      liveChatTranscript: _state => item => {
        return decodeURIComponent(item.teneoResponse.extraData.liveChat);
      },
      profileImageFromEmail: _state => email => {
        return gravatar.url(email, { protocol: "https" });
      },
      isVideoFile: _state => url => {
        // console.log("IsVideo:" + url);
        const regExp = /\.(?:mp4|webm|ogg)$/i;
        const match = url.match(regExp);
        let result = match ? match[0].substring(1, match[0].length) : false;
        // console.log(result);
        return result;
      },
      isAudioFile: _state => url => {
        // console.log("ISAudio:" + url);
        const regExp = /\.(?:wav|mp3|ogg)$/i;
        const match = url.match(regExp);
        let result = match ? match[0].substring(1, match[0].length) : false;
        // console.log(result);
        return result;
      },
      youTubeIdFromUrl: _state => url => {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#]*).*/;
        const match = url.match(regExp);
        if (match) {
          return match[7].length == 11 ? match[7] : false;
        } else {
          return false;
        }
      },
      vimeoIdFromUrl: _state => url => {
        const regExp = /^.+vimeo.com\/(.*\/)?([^#]*)/;
        const match = url.match(regExp);
        return match ? match[2] || match[1] : false;
      },
      enableLiveChat(state) {
        return state.liveAgent.enableLiveChat;
      },
      chatConfig(state) {
        return state.chatConfig;
      },
      extensionIsInline: _state => extension => {
        if (extension && extension.inline) {
          return extension.inline;
        } else {
          return false;
        }
      },
      itemExtensionsModal: (_state, getters) => item => {
        let extensions = getters.itemExtensions(item);
        let modalExtensions = [];
        extensions.forEach(extension => {
          if (!getters.extensionIsInline(extension) && !extension.name.startsWith("displayCollection")) {
            modalExtensions.push(extension);
          }
        });
        return modalExtensions;
      },
      itemExtraData: _state => (item, name) => {
        let response = {};
        if (item && item.teneoResponse && name in item.teneoResponse.extraData) {
          response = JSON.parse(decodeURIComponent(item.teneoResponse.extraData[name]));
        }
        return response;
      },
      itemExtensions: _state => item => {
        let actions = [];
        if (item && item.teneoResponse) {
          if (
            Object.keys(item.teneoResponse.extraData).some(function(k) {
              return ~k.indexOf("extensions");
            })
          ) {
            // sort the keys for ordering of extensions
            const ordered = {};
            Object.keys(item.teneoResponse.extraData)
              .sort()
              .forEach(function(key) {
                ordered[key] = item.teneoResponse.extraData[key];
              });
            try {
              for (var key in ordered) {
                if (key.startsWith("extensions")) {
                  var value = decodeURIComponent(ordered[key]);
                  // console.log(`Key: ${key} Value: ${value}`);
                  actions.push(JSON.parse(value));
                }
              }
            } catch (e) {
              console.error(e);
              // store.commit("SHOW_MESSAGE_IN_CHAT", "Problems with extension format: " + e.message + ".");
            }
          }
        }
        return actions;
      },
      ctxParameters(state) {
        let ctxParams = state.connection.ctxParameters;
        if (ctxParams) {
          let queryParams = Object.keys(ctxParams)
            .map(key => key + "=" + encodeURIComponent(ctxParams[key]))
            .join("&");
          return `&${queryParams}`;
        }
        return "";
      },
      hasModal: (_state, getters) => item => {
        let extensions = getters.itemExtensions(item);
        let hasModal = false;
        extensions.forEach(extension => {
          if (extension && !extension.inline && !extension.name.startsWith("displayCollection")) {
            hasModal = true;
          }
        });

        return hasModal;
      },
      hasInline: (_state, getters) => item => {
        let extensions = getters.itemExtensions(item);
        let hasInline = false;
        extensions.forEach(extension => {
          if (extension && extension.inline) {
            hasInline = true;
          }
        });
        return hasInline;
      },
      hasInlineType: (_state, getters) => (extension, type) => {
        if (extension && extension.inline) {
          switch (type) {
            case "youTube":
              if (getters.youTubeVideoId(extension)) {
                return true;
              }
              break;
            case "audio":
              if (getters.audioInfo(extension)) {
                return true;
              }
              break;
            case "vimeo":
              if (getters.vimeoId(extension)) {
                return true;
              }
              break;
            case "video":
              if (getters.videoInfo(extension)) {
                return true;
              }
              break;
            case "image":
              if (getters.imageUrl(extension)) {
                return true;
              }
              break;
            case "carousel":
              if (getters.carouselImageArray(extension)) {
                return true;
              }
              break;
            default:
              return false;
          }
        }
        return false;
      },
      youTubeVideoId: (_state, getters) => extension => {
        if (extension && extension.name === "displayVideo") {
          let url = extension.parameters.video_url;
          let videoId = getters.youTubeIdFromUrl(url);
          if (videoId) {
            return videoId;
          }
        }

        return "";
      },
      audioInfo: (_state, getters) => extension => {
        if (extension && extension.name === "displayVideo") {
          let url = extension.parameters.video_url;
          const audioFileExt = getters.isAudioFile(url);
          if (audioFileExt) {
            return {
              audioType: `audio/${audioFileExt}`,
              audioUrl: url
            };
          }
        }

        return {};
      },
      vimeoId: (_state, getters) => extension => {
        if (extension && extension.name === "displayVideo") {
          let url = extension.parameters.video_url;
          const vimeoId = getters.vimeoIdFromUrl(url);
          if (vimeoId) {
            return vimeoId;
          }
        }

        return;
      },
      videoInfo: (_state, getters) => extension => {
        if (extension && extension.name === "displayVideo") {
          let url = extension.parameters.video_url;
          const videoFileExt = getters.isVideoFile(url);
          if (videoFileExt) {
            return {
              videoType: `video/${videoFileExt}`,
              videoUrl: url
            };
          }
        }

        return;
      },
      imageUrl: (_state, _getters) => extension => {
        if (extension && extension.name === "displayImage") {
          // console.log(`image URL ${extension.parameters.image_url}`);
          return extension.parameters.image_url;
        }
        return "";
      },
      carouselImageArray: (_state, _getters) => extension => {
        if (extension && extension.name === "displayImageCarousel") {
          return extension.parameters.images;
        }
        return [];
      },
      iFrameUrlBase(state) {
        return state.iframe.iframeUrlBase;
      },
      firebase(state) {
        return state.auth.firebase;
      },
      isLiveChat(state) {
        return state.liveAgent.isLiveChat;
      },
      knowledgeData(state) {
        return state.knowledgeData;
      },
      settingLongResponsesInModal(state) {
        return state.activeSolution.longResponsesInModal ? state.activeSolution.longResponsesInModal === "true" : false;
      },
      pulseButton(state) {
        return state.activeSolution.pulseButton ? state.activeSolution.pulseButton === "true" : false;
      },
      lastItemAnswerTextCropped(_state, getters) {
        let answer = "";
        if (getters.lastReplyItem) {
          answer = getters.lastReplyItem.text;
        }

        if (getters.settingLongResponsesInModal && getters.lastItemHasLongResponse) {
          answer = answer.substr(0, 300 - 1) + (answer.length > 300 ? "&hellip;" : "");
        }
        return answer;
      },
      itemAnswerTextCropped: (_state, getters) => item => {
        let answer = item.text;
        if (getters.settingLongResponsesInModal && getters.itemHasLongResponse(item)) {
          answer = answer.substr(0, 300 - 1) + (answer.length > 300 ? "&hellip;" : "");
        }
        return answer;
      },
      lastItemHasLongResponse(_state, getters) {
        let hasLongResponse = false;
        if (getters.settingLongResponsesInModal) {
          let item = getters.lastReplyItem;
          if (item && item.text && item.text.length > 400) {
            hasLongResponse = true;
          }
        }
        return hasLongResponse;
      },
      itemHasLongResponse: (_state, getters) => item => {
        let hasLongResponse = false;
        if (getters.settingLongResponsesInModal && item && item.text && item.text.length > 400) {
          hasLongResponse = true;
        }
        return hasLongResponse;
      },
      showCustomModal(state) {
        return state.modals.showCustomModal;
      },
      speakBackResponses(state) {
        return state.tts.speakBackResponses;
      },
      liveChatMessage(state) {
        return state.liveAgent.liveChatMessage;
      },
      showChatLoading(state) {
        return state.progress.showChatLoading;
      },
      teneoUrl(state) {
        return state.connection.teneoUrl;
      },
      showLiveChatProcessing(state) {
        return state.liveAgent.showLiveChatProcessing;
      },
      chatHistory(state) {
        if (config.USE_SESSION_STORAGE) {
          if (state.conversation.dialog.length !== 0) {
            let chatHistory = JSON.parse(sessionStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, "[]"));
            if (chatHistory && chatHistory.length !== 0) {
              state.conversation.dialog.concat(chatHistory);
            }
          } else {
            state.conversation.dialog = JSON.parse(
              sessionStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, "[]")
            );
          }
        } else if (config.USE_LOCAL_STORAGE) {
          if (state.conversation.dialog.length !== 0) {
            let chatHistory = JSON.parse(localStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, "[]"));
            if (chatHistory && chatHistory.length !== 0) {
              state.conversation.dialog.concat(chatHistory);
            }
          } else {
            state.conversation.dialog = JSON.parse(localStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, "[]"));
          }
        }
        if (!state.conversation.dialog) {
          state.conversation.dialog = [];
        }
        return state.conversation.dialog;
      },
      chatHistorySessionStorage(state) {
        // TODO: Try and make the chat history in session storage unique to the deeplink
        if (state.conversation.dialogHistory.length === 0) {
          state.conversation.dialogHistory = JSON.parse(
            sessionStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY)
          );
          if (state.conversation.dialogHistory === null) {
            state.conversation.dialogHistory = [];
          }
        }
        return state.conversation.dialogHistory;
      },
      userInput(state) {
        return state.userInput.userInput;
      },
      embed(state) {
        return state.ui.embed;
      },
      overlayChat(state) {
        return state.ui.overlayChat;
      },
      float(state) {
        return state.ui.overlayChat;
      },
      dialog(state) {
        return state.conversation.dialog;
      },
      dialogHistory(state) {
        return state.conversation.dialogHistory;
      },
      progressBar(state) {
        return state.progress.progressBar;
      },
      stopAudioCapture(state) {
        return state.asr.stopAudioCapture;
      },
      showModal(state) {
        return state.modals.showModal;
      },
      showConfigModal(state) {
        return state.modals.showConfigModal;
      },
      modalItem(state) {
        return state.modals.modalItem;
      },
      authenticated(state) {
        return state.auth.userInfo.user ? true : false;
      },
      userProfileImage(state) {
        return state.auth.userInfo.user ? state.auth.userInfo.user.photoURL : "";
      },
      displayName(state) {
        return state.auth.userInfo.user ? state.auth.userInfo.user.displayName : "Anonymous";
      },
      dark(state) {
        return state.ui.dark;
      },
      chatTitle(state) {
        return state.ui.chatTitle;
      },
      showChatIcons(state) {
        return state.activeSolution.showChatIcons !== undefined ? state.activeSolution.showChatIcons === "true" : true;
      },
      showUploadButton(state) {
        return state.ui.showUploadButton;
      }
    },
    mutations: {
      SHOW_UPLOAD_BUTTON(state) {
        state.ui.showUploadButton = true;
      },
      HIDE_UPLOAD_BUTTON(state) {
        state.ui.showUploadButton = false;
      },
      HIDE_CUSTOM_MODAL(state) {
        state.modals.showCustomModal = false;
      },
      TOGGLE_CHAT_WINDOW_DISPLAY(state) {
        if (!state.ui.showButtonOnly) {
          state.ui.showChatWindow = !state.ui.showChatWindow;
        }
        if (state.ui.showChatWindow) {
          state.ui.chatButtonInitial = false;
        } else {
          state.ui.chatButtonInitial = true;
        }
      },
      TOGGLE_CHAT_BUTTON(state) {
        state.ui.chatButtonInitial = !state.ui.chatButtonInitial;
      },
      SHOW_CHAT_WINDOW(state) {
        state.ui.showChatWindow = true;
        state.ui.chatButtonInitial = false;
      },
      HIDE_CHAT_WINDOW(state) {
        state.ui.showChatWindow = false;
      },
      HIDE_CHAT_BUTTON(state) {
        state.ui.showChatButton = false;
      },
      SHOW_CHAT_BUTTON(state) {
        state.ui.showChatButton = true;
      },
      TOGGLE_CHAT_BUTTON_DISPLAY(state) {
        state.ui.showChatButton = !state.ui.showChatButton;
      },
      SHOW_CUSTOM_MODAL(state) {
        state.modals.showCustomModal = true;
      },
      PUSH_RESPONSE_TO_DIALOG(state, response) {
        state.conversation.dialog.push(response);
      },
      PUSH_RESPONSE_TO_DIALOG_HISTORY(state, response) {
        state.conversation.dialogHistory.push(response);
      },
      PUSH_USER_INPUT_TO_DIALOG_HISTORY(state, userInput) {
        state.conversation.dialogHistory.push(userInput);
      },
      SET_CHAT_TITLE(state, title) {
        state.ui.chatTitle = title;
      },
      SET_DIALOG_HISTORY(state, newHistory) {
        state.conversation.dialogHistory = newHistory;
      },
      PUSH_USER_INPUT_TO_DIALOG(state, userInput) {
        state.conversation.dialog.push(userInput);
      },
      PUSH_LIVE_CHAT_STATUS_TO_DIALOG(state, liveChatStatus) {
        state.conversation.dialog.push(liveChatStatus);
      },
      SHOW_MESSAGE_IN_CHAT(state, message) {
        let miscMessage = {
          type: "miscMessage",
          text: message,
          bodyText: "",
          hasExtraData: false
        };
        state.conversation.dialog.push(miscMessage);
      },
      PUSH_LIVE_CHAT_RESPONSE_TO_DIALOG(state, liveChatResponse) {
        state.conversation.dialog.push(liveChatResponse);
      },
      CLEAR_USER_INPUT(state) {
        state.userInput.userInput = "";
        if (state.browser.isMobile) {
          document.activeElement.blur();
        }
      },
      SHOW_CHAT_LOADING(state) {
        state.progress.showChatLoading = true;
      },
      HIDE_CHAT_LOADING(state) {
        state.progress.showChatLoading = false;
      },
      LIVE_CHAT_LOADING(state, mustShow) {
        state.liveAgent.showLiveChatProcessing = mustShow;
      },
      SHOW_LIVE_CHAT_LOADING(state) {
        state.liveAgent.showLiveChatProcessing = true;
      },
      HIDE_LIVE_CHAT_LOADING(state) {
        state.liveAgent.showLiveChatProcessing = false;
      },
      CLEAR_CHAT_HISTORY(state) {
        state.conversation.dialog = [];
      },
      LIVE_CHAT(_state, transcript) {
        config.liveChat.sendMessage(transcript);
      },
      START_LIVE_CHAT(state) {
        state.liveAgent.isLiveChat = true;
      },
      STOP_LIVE_CHAT(state) {
        state.liveAgent.isLiveChat = false;
      },
      CHANGE_THEME(state) {
        state.ui.dark = !state.ui.dark;
        localStorage.setItem(STORAGE_KEY + config.TENEO_CHAT_DARK_THEME, JSON.stringify(state.ui.dark));
      },
      SHOW_LISTING_OVERLAY(state) {
        state.progress.listening = true;
      },
      HIDE_LISTENING_OVERLAY(state) {
        state.progress.listening = false;
      },
      SET_USER_INPUT(state, userInput) {
        if (userInput) {
          //state.userInput.userInput = userInput.replace(/^\w/, c => c.toUpperCase());
          state.userInput.userInput = userInput;
        }
      },
      START_TTS(state) {
        state.tts.speakBackResponses = true;
      },
      STOP_TTS(state) {
        state.tts.speakBackResponses = false;
      },
      TTS_ENABLE(state, useTTS) {
        state.tts.speakBackResponses = useTTS;
      },
      UPDATE_CHAT_WINDOW_AND_STORAGE(state, payload) {
        let hasExtraData = false;

        if (
          payload.response.teneoResponse &&
          (Object.keys(payload.response.teneoResponse.extraData).some(function(k) {
            return ~k.indexOf("extensions");
          }) ||
            payload.response.teneoResponse.extraData.liveChat ||
            payload.response.teneoResponse.link.href)
        ) {
          hasExtraData = true;
        }

        let newUserInput = {
          type: "userInput",
          text: payload.mask ? "*********" : payload.response.userInput,
          bodyText: "",
          hasExtraData: false
        };

        // add the user input - display it on the chat dialog
        if (newUserInput.text) {
          state.conversation.dialog.push(newUserInput);
        }

        let newReply = {
          type: "reply",
          text: payload.response.teneoAnswer,
          bodyText: "",
          teneoResponse: payload.response.teneoResponse,
          hasExtraData: hasExtraData
        };

        // add the teneo response - display it on the chat dialog
        state.conversation.dialog.push(newReply);
        if (hasExtraData) {
          state.modals.modalItem = newReply;
          state.modals.showModal = true;
        }

        state.userInput.userInput = ""; // reset the user input to nothing

        // deal with persiting the chat history
        if (config.USE_LOCAL_STORAGE) {
          localStorage.setItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, JSON.stringify(state.conversation.dialog));
        }
        state.conversation.dialogHistory = JSON.parse(sessionStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY));
        if (state.conversation.dialogHistory === null) {
          state.conversation.dialogHistory = state.conversation.dialog;
        } else {
          // add current user input and teneo response to the dialog history
          if (newUserInput.text) {
            state.conversation.dialogHistory.push(newUserInput);
          }
          state.conversation.dialogHistory.push(newReply);
        }
        // save the dislaog history in session storage
        sessionStorage.setItem(
          STORAGE_KEY + config.TENEO_CHAT_HISTORY,
          JSON.stringify(state.conversation.dialogHistory)
        );
      },
      SHOW_PROGRESS_BAR(state) {
        state.progress.progressBar = true;
      },
      HIDE_PROGRESS_BAR(state) {
        state.progress.progressBar = false;
      },
      SHOW_CONFIG_MODAL(state) {
        state.modals.showConfigModal = true;
      },
      HIDE_CONFIG_MODAL(state) {
        state.modals.showConfigModal = false;
      },
      UPDATE_TENEO_URL(state, newUrl) {
        state.connection.teneoUrl = newUrl;
      },
      SHOW_CHAT_MODAL(state, item) {
        state.modals.modalItem = item;
        state.modals.showModal = true;
      },
      STOP_AUDIO_CAPTURE(state) {
        state.asr.stopAudioCapture = true;
      },
      START_AUDIO_CAPTURE(state) {
        if (state.asr.asr != null) {
          if (state.tts.tts.isSpeaking()) {
            state.tts.tts.shutUp();
          }
          state.asr.stopAudioCapture = false;
          state.asr.asr.start();
        }
      },
      HIDE_CHAT_MODAL(state) {
        // console.log("hiding modal");
        state.userInput.userInputReadyForSending = false;
        state.modals.showModal = false;
        state.modals.modalItem = null;
        // console.log("modal item should be empty");
      },
      CLEAR_DIALOGS(state) {
        state.conversation.dialog = [];
      },
      USER_INPUT_READY_FOR_SENDING(state) {
        state.userInput.userInputReadyForSending = true;
      },
      USER_INPUT_NOT_READY_FOR_SENDING(state) {
        state.userInput.userInputReadyForSending = false;
      },
      REMOVE_MODAL_ITEM(state) {
        state.modals.modalItem = null;
      },
      AGENT_NAME(state, agentName) {
        state.liveAgent.agentName = agentName;
      },
      AGENT_ID(state, agentId) {
        state.liveAgent.agentID = agentId;
      },
      AGENT_AVATAR(state, imageUrl) {
        state.liveAgent.agentAvatar = imageUrl;
      },
      UPDATE_UI_LOCALE(state, lang) {
        state.i18n.locale = lang.toLowerCase();
        Vue.i18n.set(lang);
      },
      UPDATE_FRAME_URL(state, langurl) {
        if (document.getElementById("site-frame")) {
          document.getElementById("site-frame").src = langurl;
        }
        state.iframe.iframeUrl = langurl;
        state.iframe.iframeUrlBase = langurl.substring(0, langurl.lastIndexOf("/")) + "/";
      },
      USER_INFO(state, userInfo) {
        state.auth.userInfo.user = userInfo.user;
      },
      CHANGE_ASR_TTS(state, lang) {
        state.tts.tts = initializeTTS(lang);
        initializeASR(store, config.ASR_CORRECTIONS_MERGED);
      },
      CLEAR_USER_INFO(state) {
        state.auth.userInfo.user = null;
      }
    },
    actions: {
      setUserInformation({ commit, getters }) {
        if (getters.firebase) {
          getters.firebase.auth().onAuthStateChanged(function(user) {
            if (user) {
              commit("USER_INFO", { user: user }); // user is still signed in
            }
          });
        }
      },
      logout({ commit, getters }) {
        getters.firebase
          .auth()
          .signOut()
          .then(
            () => {
              commit("CLEAR_USER_INFO");
              console.log("Signed out");
            },
            function(error) {
              // An error happened.
              console.error(error.message);
            }
          );
      },
      loginSocial({ commit, getters }, socialProvider) {
        return new Promise((resolve, reject) => {
          let provider = null;
          switch (socialProvider) {
            case "google":
              provider = new firebase.auth.GoogleAuthProvider();
              break;
            case "facebook":
              provider = new firebase.auth.FacebookAuthProvider();
              break;
            case "github":
              provider = new firebase.auth.GithubAuthProvider();
              break;
            default:
              break;
          }
          // getters.firebase.auth().languageCode = "en";
          // To apply the default browser preference instead of explicitly setting it.
          firebase.auth().useDeviceLanguage();

          getters.firebase
            .auth()
            .signInWithPopup(provider)
            .then(function(result) {
              // This gives you a Google Access Token. You can use it to access the Google API.
              // var token = result.credential.accessToken;
              // The signed-in user info.
              let user = result.user;
              // console.log(user);
              commit("USER_INFO", { user: user });
              resolve();
            })
            .catch(function(error) {
              // Handle Errors here.
              // var errorCode = error.code;
              // var errorMessage = error.message;
              // // The email of the user's account used.
              // var email = error.email;
              // // The firebase.auth.AuthCredential type that was used.
              // var credential = error.credential;
              // ...
              reject(error.message);
            });
        });
      },
      loginUserWithUsernameEmailPassword({ commit, getters }, loginInfo) {
        return new Promise((resolve, reject) => {
          loginInfo.photoURL = getters.profileImageFromEmail(loginInfo.email);
          getters.firebase
            .auth()
            .signInWithEmailAndPassword(loginInfo.email, loginInfo.password)
            .then(user => {
              commit("USER_INFO", { user: user });
              resolve();
            })
            .catch(function(error) {
              reject(error.message);
            });
        });
      },
      registerUserWithUsernameEmailPassword({ commit, getters }, registrationInfo) {
        return new Promise((resolve, reject) => {
          registrationInfo.photoURL = getters.profileImageFromEmail(registrationInfo.email);
          getters.firebase
            .auth()
            .createUserWithEmailAndPassword(registrationInfo.email, registrationInfo.password)
            .then(user => {
              let currentUser = getters.firebase.auth().currentUser;
              currentUser
                .updateProfile({
                  displayName: registrationInfo.displayName,
                  photoURL: registrationInfo.photoURL
                })
                .then(function() {
                  console.log("User's profile info updated");
                })
                .catch(function(error) {
                  console.log(`Unable to update user's profile information: ${error.message}`);
                });
              commit("USER_INFO", { user: user });
              resolve();
            })
            .catch(function(error) {
              reject(error.message);
            });
        });
      },
      stopAudioCapture(context) {
        if (context.getters.tts.isSpeaking()) {
          // console.log("muted TTS!");
          context.getters.tts.shutUp();
        }
        if (context.getters.tts.isObeying()) {
          context.getters.asr.stop();
          context.commit("STOP_AUDIO_CAPTURE");
        }
      },
      endSession(context) {
        context.commit("CLEAR_DIALOGS");
        context.commit("REMOVE_MODAL_ITEM");
        let fullUrl = new URL(context.getters.teneoUrl);
        let endSessionUrl =
          fullUrl.protocol +
          "//" +
          fullUrl.host +
          fullUrl.pathname +
          "endsession?viewtype=STANDARDJSONP" +
          (config.SEND_CTX_PARAMS === "all"
            ? config.REQUEST_PARAMETERS.length > 0
              ? "&" + config.REQUEST_PARAMETERS.substring(1, config.REQUEST_PARAMETERS.length)
              : ""
            : "");

        Vue.jsonp(endSessionUrl, {}).then(console.log("Session Ended"));
      },
      login(context) {
        // get the greeting message if we haven't done so for this session
        return new Promise((resolve, reject) => {
          Vue.jsonp(
            config.TENEO_URL +
              config.REQUEST_PARAMETERS +
              context.getters.userInformationParams +
              context.getters.timeZoneParam +
              context.getters.ctxParameters,
            {
              command: "login"
              // userInput: ""
            }
          )
            .then(json => {
              context.commit("HIDE_CHAT_LOADING"); // about to show the greeting - hide the chat loading spinner
              // console.log(decodeURIComponent(json.responseData.answer))
              let hasExtraData = false;

              if (
                Object.keys(json.responseData.extraData).some(function(k) {
                  return ~k.indexOf("extensions");
                }) ||
                json.responseData.extraData.liveChat
              ) {
                hasExtraData = true;
              }
              const response = {
                type: "reply",
                text: config.markDownConvertor.makeHtml(
                  decodeURIComponent(json.responseData.answer).replace(/onclick="[^"]+"/g, 'class="sendInput"')
                ),
                bodyText: "",
                teneoResponse: json.responseData,
                hasExtraData: hasExtraData
              };
              // sessionStorage.setItem(STORAGE_KEY + TENEO_CHAT_HISTORY, JSON.stringify(response))
              context.commit("PUSH_RESPONSE_TO_DIALOG", response); // push the getting message onto the dialog
              if (hasExtraData) {
                context.commit("SHOW_CHAT_MODAL", response);
              }
              resolve();
            })
            .catch(err => {
              console.log(err);
              context.commit(
                "SHOW_MESSAGE_IN_CHAT",
                "Problems sending login command: " +
                  err.message +
                  ". Please make sure your Solution is published and that you are referencing the correct TIE Url."
              );
              reject(err);
            });
        });
      },
      sendUserInput(context, params = "") {
        let currentUserInput = stripHtml(context.getters.userInput);
        context.commit("CLEAR_USER_INPUT");
        // send user input to Teneo when a live chat has not begun
        if (context.getters.tts && context.getters.tts.isSpeaking()) {
          // tts is speaking something. Let's shut it up
          context.getters.tts.shutUp();
        }
        if (!context.getters.isLiveChat) {
          // normal Teneo request needs to be made
          Vue.jsonp(
            context.getters.teneoUrl +
              (config.SEND_CTX_PARAMS === "all" ? config.REQUEST_PARAMETERS + params : params) +
              context.getters.userInformationParams +
              context.getters.timeZoneParam +
              context.getters.ctxParameters,
            {
              userinput: currentUserInput.trim()
            }
          )
            .then(json => {
              if (json.responseData.isNewSession || json.responseData.extraData.newsession) {
                console.log("Session is stale.. keep chat open and continue with the new session");
              }

              if (
                json.responseData.extraData.hasOwnProperty("inputType") &&
                json.responseData.extraData.inputType === "upload"
              ) {
                context.commit("SHOW_UPLOAD_BUTTON");
              }

              // look for request for location information in the response
              if (
                json.responseData.extraData.hasOwnProperty("inputType") &&
                json.responseData.extraData.inputType.startsWith("location")
              ) {
                config
                  .getLocator()
                  .then(function(position) {
                    // we now have the user's lat and long
                    console.log(`${position.coords.latitude}, ${position.coords.longitude}`);
                    if (json.responseData.extraData.inputType === "locationLatLong") {
                      // send the lat and long
                      context
                        .dispatch(
                          "sendUserInput",
                          "&locationLatLong=" + encodeURI(position.coords.latitude + "," + position.coords.longitude)
                        )
                        .then(
                          console.log(
                            `Sent user's lat and long: ${position.coords.latitude}, ${position.coords.longitude}`
                          )
                        )
                        .catch(err => {
                          console.err("Unable to send lat and long info", err.message);
                          context.commit(
                            "SHOW_MESSAGE_IN_CHAT",
                            "We were unable to obtain your location information.: " + err.message
                          );
                        });
                    } else if (process.env.VUE_APP_LOCATION_IQ_KEY) {
                      // good we have a licence key we can send all location information back
                      let locationRequestType = json.responseData.extraData.inputType;
                      axios
                        .get(
                          `https://us1.locationiq.com/v1/reverse.php?key=${process.env.VUE_APP_LOCATION_IQ_KEY}&lat=${
                            position.coords.latitude
                          }&lon=${position.coords.longitude}&format=json`
                        )
                        .then(response => {
                          let data = response.data;
                          console.log(`${data.address.city}, ${data.address.state} ${data.address.postcode}`);

                          let queryParam = `&${locationRequestType}=`;
                          if (locationRequestType === "locationJson") {
                            queryParam += encodeURI(JSON.stringify(data));
                          } else if (locationRequestType === "locationZip") {
                            queryParam += encodeURI(data.address.postcode);
                          } else if (locationRequestType === "locationCityStateZip") {
                            queryParam += encodeURI(
                              `${data.address.city}, ${data.address.state} ${data.address.postcode}`
                            );
                          }

                          context
                            .dispatch("sendUserInput", queryParam)
                            .then(
                              console.log(
                                `Sent user's location information: ${data.address.city}, ${data.address.state} ${
                                  data.address.postcode
                                }`
                              )
                            )
                            .catch(err => {
                              console.err("Unable to send user location", err.message);
                              context.commit(
                                "SHOW_MESSAGE_IN_CHAT",
                                "We were unable to obtain your location information.: " + err.message
                              );
                            });
                        })
                        .catch(error => {
                          console.log(error.message);
                        });
                    } else if (
                      !process.env.VUE_APP_LOCATION_IQ_KEY &&
                      json.responseData.extraData.inputType ===
                        ("locationCityStateZip" || "locationZip" || "locationJson")
                    ) {
                      // no good. Asking for location information that requires a licence  key
                      context.commit(
                        "SHOW_MESSAGE_IN_CHAT",
                        "A licence key for https://locationiq.com/ is needed to obtain the requested location information. Check the documentation."
                      );
                    }
                  })
                  .catch(function(err) {
                    console.error("Position Error ", err.toString());
                  });
              }

              // console.log(decodeURIComponent(json.responseData.answer))
              const response = {
                userInput: currentUserInput,
                teneoAnswer: config.markDownConvertor.makeHtml(
                  decodeURIComponent(json.responseData.answer).replace(/onclick="[^"]+"/g, 'class="sendInput"')
                ),
                teneoResponse: json.responseData
              };

              if (response.teneoResponse) {
                let ttsText = stripHtml(response.teneoAnswer);
                if (response.teneoResponse.extraData.tts) {
                  ttsText = stripHtml(decodeURIComponent(response.teneoResponse.extraData.tts));
                }

                // check if this browser supports the Web Speech API
                if (window.hasOwnProperty("webkitSpeechRecognition") && window.hasOwnProperty("speechSynthesis")) {
                  if (context.getters.tts && context.getters.speakBackResponses) {
                    context.getters.tts.say(ttsText);
                  }
                }

                if (context.getters.askingForPassword) {
                  context.commit("UPDATE_CHAT_WINDOW_AND_STORAGE", {
                    response,
                    mask: true
                  });
                } else {
                  context.commit("UPDATE_CHAT_WINDOW_AND_STORAGE", {
                    response,
                    mask: false
                  });
                }

                context.commit("HIDE_PROGRESS_BAR");
                if (response.teneoResponse.extraData.liveChat) {
                  context.commit("START_LIVE_CHAT");
                }
                if (response.teneoResponse.extraData.chatTitle) {
                  let chatTitle = decodeURIComponent(response.teneoResponse.extraData.chatTitle);
                  if (chatTitle !== "undefined") {
                    context.commit("SET_CHAT_TITLE", chatTitle);
                  }
                }

                // added on request from Mark J - switch languages based on NER language detection
                let langInput = decodeURIComponent(response.teneoResponse.extraData.langinput);
                let langEngineUrl = decodeURIComponent(response.teneoResponse.extraData.langengineurl);
                let lang = decodeURIComponent(response.teneoResponse.extraData.lang);
                let langurl = decodeURIComponent(response.teneoResponse.extraData.langurl);

                if (langEngineUrl !== "undefined" && langInput !== "undefined") {
                  context.commit("UPDATE_TENEO_URL", langEngineUrl + "?viewname=STANDARDJSONP");
                  context.commit("SET_USER_INPUT", langInput);
                  context.commit("SHOW_PROGRESS_BAR");

                  if (lang !== "undefined") {
                    context.commit("UPDATE_UI_LOCALE", lang);
                    context.commit("CHANGE_ASR_TTS", lang);
                  }

                  if (langurl !== "undefined") {
                    context.commit("UPDATE_FRAME_URL", langurl);
                  }

                  context
                    .dispatch("sendUserInput")
                    .then(console.log("Sent original lang input to new lang specific solution"))
                    .catch(err => {
                      console.err("Unable to send lang input to new lang specific solution", err.message);
                      context.commit(
                        "SHOW_MESSAGE_IN_CHAT",
                        "Unable to send lang input to new lang specific solution: " + err.message
                      );
                    });
                }
              }
            })
            .catch(err => {
              console.log(err);
              if (err.status && err.status === 408) {
                console.log("Oh dear - Request Timed Out");
                context.commit("SHOW_MESSAGE_IN_CHAT", "I'm sorry but the request timed out - Please try again.");
              } else {
                context.commit("SHOW_MESSAGE_IN_CHAT", err.message);
              }
              context.commit("HIDE_PROGRESS_BAR");
            });
        } else {
          // send the input to live chat agent and save user input to history
          let newUserInput = {
            type: "userInput",
            text: currentUserInput,
            bodyText: "",
            hasExtraData: false
          };
          context.commit("PUSH_USER_INPUT_TO_DIALOG", newUserInput);

          if (config.USE_LOCAL_STORAGE) {
            localStorage.setItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY, JSON.stringify(context.getters.dialog));
          }
          context.commit(
            "SET_DIALOG_HISTORY",
            JSON.parse(sessionStorage.getItem(STORAGE_KEY + config.TENEO_CHAT_HISTORY))
          );
          if (context.getters.dialogHistory === null) {
            context.commit("SET_DIALOG_HISTORY", context.getters.dialog);
          } else {
            context.commit("PUSH_USER_INPUT_TO_DIALOG_HISTORY", newUserInput);
          }
          sessionStorage.setItem(
            STORAGE_KEY + config.TENEO_CHAT_HISTORY,
            JSON.stringify(context.getters.dialogHistory)
          );
          config.liveChat.sendMessage(currentUserInput);
          context.commit("HIDE_PROGRESS_BAR");
          context.commit("CLEAR_USER_INPUT");
        }
      },
      captureAudio(context) {
        context.commit("START_AUDIO_CAPTURE");
      }
    }
  });

  // setup i18n for Leopard UI
  Vue.use(vuexI18n.plugin, store);
  Object.keys(TRANSLATIONS).forEach(function(key) {
    Vue.i18n.add(key, TRANSLATIONS[key]);
  });
  Vue.i18n.set(config.LOCALE);

  // Setup ASR
  initializeASR(store, config.ASR_CORRECTIONS_MERGED);

  // Setup Live Chat
  config.setupLiveChat(store);

  callback(store);
}

function stoperror() {
  return true;
}

window.addEventListener("message", function(event) {
  try {
    let messageObject = JSON.parse(event.data);
    if ("info" in messageObject && "id" in messageObject) {
      return true;
    }
    console.log(messageObject);
    store.state.connection.ctxParameters = messageObject;
  } catch (error) {
    stoperror();
  }
});
