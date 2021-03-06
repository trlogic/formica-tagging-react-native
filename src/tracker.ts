//  ******************** TRACKER  ********************
import axios, {AxiosInstance} from "axios";
import {MutableRefObject} from "react";
import {EventArg, NavigationContainerRef, NavigationState} from "@react-navigation/native";
import {AppState, AppStateStatus, DeviceEventEmitter} from "react-native";
import DeviceInfo from "react-native-device-info";

declare type KeyValueMap<T = string> = { [key: string]: T };
declare type TrackerPayload = Event;
declare type TrackerResponse = {
  authServerUrl: string;
  eventApiUrl: string,
  trackers: Array<TrackerSchema>
}
//  ******************** INSTANCE  ********************

const _axios: AxiosInstance = axios.create({headers: {"Content-Type": "application/json"}});
const eventQueue: Event[] = [];

const trackerConfig: TrackerConfig = {
  authServerUrl: "",
  eventApiUrl: "",
  trackers: []
};

let reactNavigationRef: MutableRefObject<NavigationContainerRef<{}>>;

let timerInstance: any = undefined;

const globalVariables: KeyValueMap<any> = {
  screenViewDuration: 0
}

//  ******************** MAIN  ********************
export namespace FormicaTracker {
  export const run = async (serviceUrl: string, _navigationRef: MutableRefObject<NavigationContainerRef<{}>>): Promise<void> => {
    reactNavigationRef = _navigationRef;

    await getTrackers(serviceUrl);
    initClientWorker();
    initTimer();
    trackerConfig.trackers.forEach(tracker => tracker.triggers.forEach(triggerSchema => initListener(triggerSchema, tracker.variables, tracker.event)));
  };

  export const track = (payload: TrackerPayload) => {
    eventQueue.push(payload);
  }
}

const getTrackers = async (serviceUrl: string) => {
  try {
    const config = await _axios.get<TrackerResponse>(`${serviceUrl}/formicabox/activity-monitoring-service/v1/tracker/get-config`)
    trackerConfig.trackers = config.data.trackers.filter(tracker => tracker.platform == "ReactNative");
    trackerConfig.eventApiUrl = config.data.eventApiUrl;
    trackerConfig.authServerUrl = config.data.authServerUrl;
  } catch (e) {
    console.error("Formica tracker config couldn't get", e);
  }
}

const initClientWorker = () => {
  setInterval(args => {

    const events: TrackerPayload[] = [];
    while (eventQueue.length > 0) {
      const event: TrackerPayload = eventQueue.pop()!;
      events.push(event);
    }
    const url = `${trackerConfig.eventApiUrl}/event-listener/event/send-event/moneybo/async`
    if (events.length > 0) {
      _axios.post(url, {events});
    }
  }, 3000);
};

//  ******************** TIMER  ********************

const initTimer = () => {
  timerInstance = setInterval(timerHandler, 100);
}

const resetTimer = () => {
  globalVariables.viewDuration = 0;
}

const timerHandler = () => {
  globalVariables.viewDuration += 100;
}

//  ******************** EVENT HANDLERS  ********************

type NavigationCallback = EventArg<"state", false, { state: NavigationState; }>

const initListener = (triggerSchema: TriggerSchema, trackerVariableSchemas: TrackerVariableSchema[], eventSchema: EventSchema) => {
  switch (triggerSchema.name) {
    case "screenView":
      reactNavigationRef.current.addListener("state", (state: any) => {
        const trackerVariables: KeyValueMap = {};
        trackerVariableSchemas.forEach(trackerVariableSchema => {
          trackerVariables[trackerVariableSchema.name] = resolveTrackerVariable(trackerVariableSchema, {state});
        });
        resetTimer();
        const validated: boolean = validate(triggerSchema, trackerVariables);
        if (validated) {
          const event: Event = buildEvent(eventSchema, trackerVariables);
          sendEvent(event);
        }
      });
      break;
    case "appState":
      AppState.addEventListener("change", (state: AppStateStatus) => {
        const trackerVariables: KeyValueMap = {};
        trackerVariableSchemas.forEach(trackerVariableSchema => {
          trackerVariables[trackerVariableSchema.name] = resolveTrackerVariable(trackerVariableSchema, {appState: state});
        });
        resetTimer();
        const validated: boolean = validate(triggerSchema, trackerVariables);
        if (validated) {
          const event: Event = buildEvent(eventSchema, trackerVariables);
          sendEvent(event);
        }
      });
      break;
    case "timer":
      break;
    default:
      DeviceEventEmitter.addListener(triggerSchema.name, (args: KeyValueMap<any>) => {
        const trackerVariables: KeyValueMap = {};
        trackerVariableSchemas.forEach(trackerVariableSchema => {
          trackerVariables[trackerVariableSchema.name] = resolveTrackerVariable(trackerVariableSchema, {custom: args});
        });

        const validated: boolean = validate(triggerSchema, trackerVariables);
        if (validated) {
          const event: Event = buildEvent(eventSchema, trackerVariables);
          sendEvent(event);
        }
      })
  }
};

const validate = (triggerSchema: TriggerSchema, trackerVariables: KeyValueMap): boolean => {
  return triggerSchema.filters.length == 0 || triggerSchema.filters.every(filter => calculateFilter(filter, trackerVariables));
};

//  ******************** CLIENT ********************
const sendEvent = (event: Event) => {
  eventQueue.push(event);
};

//  ******************** CONFIG ********************
interface TrackerConfig {
  trackers: TrackerSchema[];

  eventApiUrl: string;

  authServerUrl: string;
}

//  ******************** EVENT ********************
interface Event {
  name: string;

  actor: string;

  variables: { [key: string]: string | number | boolean };
}

interface EventSchema {
  name: string;

  actorMapping: string;

  variableMappings: { name: string, value: string }[];
}

interface TrackerSchema {
  triggers: TriggerSchema[];

  variables: TrackerVariableSchema[];

  event: EventSchema;

  platform: "Web" | "ReactNative"
}

//  ******************** TRIGGER ********************

interface TriggerSchema {
  name: string;

  filters: Filter[];

  option: ClickOption | ScrollOptions | null,
}

declare type ClickOption = { justLinks: boolean }
declare type ScrollOptions = { horizontal: boolean; vertical: boolean; }

declare type Operator =
  "isEquals" | "isEqualsIgnoreCase" | "notEquals" | "notEqualsIgnoreCase" |
  "isContains" | "isContainsIgnoreCase" | "notContains" | "notContainsIgnoreCase" |
  "isStartsWith" | "isStartsWithIgnoreCase" | "notStartsWith" | "notStartsWithIgnoreCase" |
  "isEndsWith" | "isEndsWithIgnoreCase" | "notEndsWith" | "notEndsWithIgnoreCase" |
  "isRegexMatch" | "isRegexMatchIgnoreCase" | "notRegexMatch" | "notRegexMatchIgnoreCase" |
  "lessThan" | "lessThanOrEquals" | "greaterThan" | "greaterThanOrEquals";

interface Filter {
  left: string;

  operator: Operator;

  right: string;
}

//  ******************** TRACKER VARIABLE ********************

interface TrackerVariableSchema {
  type: TrackerVariableType;

  name: string;

  option: JavascriptOption | CustomEventOption | null;
}

declare type JavascriptOption = { code: string; };

declare type CustomEventOption = { property: string }

declare type TrackerVariableType =
  "deviceId"
  | "deviceName"
  | "ipAddress"
  | "reactNavigationRoute"
  | "appState"
  | "javascript"
  | "viewDuration"
  | "customEventProperty";

// ******************** TRACKER UTILS ********************

const calculateFilter = (filter: Filter, variables: KeyValueMap): boolean => {
  const leftValue: string = variables[filter.left];
  const rightValue: string = filter.right;

  switch (filter.operator) {
    case "isEquals":
      return leftValue == rightValue;
    case "isEqualsIgnoreCase":
      return leftValue.toLowerCase() == rightValue.toLowerCase();
    case "notEquals":
      return leftValue != rightValue;
    case "notEqualsIgnoreCase":
      return leftValue.toLowerCase() != rightValue.toLowerCase();
    case "isContains":
      return leftValue.includes(rightValue);
    case "isContainsIgnoreCase":
      return leftValue.toLowerCase().includes(rightValue.toLowerCase());
    case "notContains":
      return !leftValue.includes(rightValue);
    case "notContainsIgnoreCase":
      return !leftValue.toLowerCase().includes(rightValue.toLowerCase());
    case "isStartsWith":
      return leftValue.startsWith(rightValue);
    case "isStartsWithIgnoreCase":
      return leftValue.toLowerCase().startsWith(rightValue.toLowerCase());
    case "notStartsWith":
      return !leftValue.startsWith(rightValue);
    case "notStartsWithIgnoreCase":
      return !leftValue.toLowerCase().startsWith(rightValue.toLowerCase());
    case "isEndsWith":
      return leftValue.endsWith(rightValue);
    case "isEndsWithIgnoreCase":
      return leftValue.toLowerCase().endsWith(rightValue.toLowerCase());
    case "notEndsWith":
      return !leftValue.endsWith(rightValue);
    case "notEndsWithIgnoreCase":
      return !leftValue.toLowerCase().endsWith(rightValue.toLowerCase());
    case "lessThan":
      return (Number.parseFloat(leftValue) < Number.parseFloat(rightValue));
    case "lessThanOrEquals":
      return (Number.parseFloat(leftValue) <= Number.parseFloat(rightValue));
    case "greaterThan":
      return (Number.parseFloat(leftValue) > Number.parseFloat(rightValue));
    case "greaterThanOrEquals":
      return (Number.parseFloat(leftValue) >= Number.parseFloat(rightValue));
    case "isRegexMatch": {
      const result = new RegExp(`${rightValue}`, "g").exec(leftValue);
      return result != undefined && result.length > 0;
    }
    case "isRegexMatchIgnoreCase": {
      const result = new RegExp(`${rightValue}`, "g").exec(leftValue.toLowerCase());
      return result != undefined && result.length > 0;
    }
    case "notRegexMatch": {
      const result = new RegExp(`${rightValue}`, "g").exec(leftValue);
      return !(result != undefined && result.length > 0);
    }
    case "notRegexMatchIgnoreCase": {
      const result = new RegExp(`${rightValue}`, "g").exec(leftValue.toLowerCase());
      return !(result != undefined && result.length > 0);
    }
    default:
      return false;
  }
};

const resolveTrackerVariable = (trackerVariableSchema: TrackerVariableSchema, event: { state?: NavigationCallback, appState?: AppStateStatus, custom?: KeyValueMap<any> }): string => {
  switch (trackerVariableSchema.type) {
    case "javascript":
      return resolveJavascriptVariable(trackerVariableSchema);
    case "appState":
      return AppState.currentState || "";
    case "deviceId":
      return DeviceInfo.getDeviceId();
    case "deviceName":
      return DeviceInfo.getDeviceNameSync();
    case "ipAddress":
      return DeviceInfo.getIpAddressSync();
    case "reactNavigationRoute":
      return resolveReactNavigationVariable(trackerVariableSchema);
    case "viewDuration":
      return globalVariables.viewDuration || 0;
    case "customEventProperty":
      if (event.custom && trackerVariableSchema.option && (trackerVariableSchema.option as CustomEventOption).property
        && event.custom.hasOwnProperty((trackerVariableSchema.option as CustomEventOption).property)) {
        return event.custom[(trackerVariableSchema.option as CustomEventOption).property];
      }
      return "";
    default :
      return "";
  }
};

const resolveReactNavigationVariable = (trackerVariableSchema: TrackerVariableSchema): string => {
  return reactNavigationRef.current.getCurrentRoute()?.name || "";
};

const resolveJavascriptVariable = (trackerVariableSchema: TrackerVariableSchema): string => {
  const option: JavascriptOption = trackerVariableSchema.option as JavascriptOption;
  try {
    return eval(option.code) ?? "";
  } catch (error) {
    console.error(error);
    return "";
  }
};

// -----
const buildEvent = (eventSchema: EventSchema, trackerVariables: KeyValueMap): Event => {
  const name: string = eventSchema.name;
  const actor: string = resolveMapping(eventSchema.actorMapping, trackerVariables);
  const variables: KeyValueMap = {};
  eventSchema.variableMappings.forEach(variableMapping => variables[variableMapping.name] = resolveMapping(variableMapping.value, trackerVariables));
  return {name, actor, variables};
};

const resolveMapping = (mapping: string, trackerVariables: KeyValueMap): string => {
  const matches: string[] = findMatches(mapping, /`.*?`/g);
  matches.forEach(match => {
    const variableName: string = match.substring(1, match.length - 1);
    const variableValue: string = trackerVariables[variableName];
    mapping = mapping.replace(match, variableValue);
  });

  return mapping;
};

const findMatches = (string: string, regex: RegExp): string[] => {
  const matches: string[] = [];
  let regExpExecArray: RegExpExecArray | null;
  while ((regExpExecArray = regex.exec(string)) != undefined) {
    const match = regExpExecArray[0];
    matches.push(match);
  }

  return matches;
};
