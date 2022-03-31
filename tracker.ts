//  ******************** TRACKER  ********************
import axios, { AxiosInstance } from "axios";
import { MutableRefObject } from "react";
import { EventArg, NavigationContainerRef } from "@react-navigation/native";
import { NavigationState } from "@react-navigation/native";
import { AppState, AppStateStatus } from "react-native";
import DeviceInfo from "react-native-device-info";

declare type KeyValueMap = { [key: string]: string };

const _axios: AxiosInstance = axios.create({ headers: { "Content-Type": "application/json" } });
const eventQueue: Event[] = [];

const trackerConfig: TrackerConfig = {
  authServerUrl: "",
  eventApiUrl: "",
  trackers: [
    {
      triggers: [
        {
          name: "appState",
          filters: [],
          option: null
        },
        {
          name: "route",
          filters:[],
          option: null
        }
      ],
      variables: [
        {
          name: "appState",
          type: "appState",
          option: null
        },
        {
          name: "deviceName",
          type: "deviceName",
          option: null
        },
        {
          name: "deviceId",
          type: "deviceId",
          option: null
        },
        {
          name: "ipAddress",
          type: "ipAddress",
          option: null
        },
        {
          name: "javascript",
          type: "javascript",
          option: {
            code: "(()=>{" +
              "return 15 + 30;})()"
          }
        },
        {
          name: "route",
          type: "route",
          option: null
        }
      ],
      event: {
        name: "test",
        actorMapping: "test",
        variableMappings: [
          {
            name: "appState",
            value: "`appState`"
          },
          {
            name: "deviceName",
            value: "`deviceName`"
          },
          {
            name: "deviceId",
            value: "`deviceId`"
          },
          {
            name: "ipAddress",
            value: "`ipAddress`"
          },
          {
            name: "javascript",
            value: "`javascript`"
          },
          {
            name: "route",
            value: "`route`"
          }
        ]
      }
    }
  ]
};

let navigationRef: MutableRefObject<NavigationContainerRef<{}>>;

export const run = (_navigationRef: MutableRefObject<NavigationContainerRef<{}>>): void => {
  navigationRef = _navigationRef;
  initClientWorker();
  trackerConfig.trackers.forEach(tracker => tracker.triggers.forEach(triggerSchema => initListener(triggerSchema, tracker.variables, tracker.event)));
};

const initClientWorker = () => {
  setInterval(args => {

    const events: Event[] = [];
    while (eventQueue.length > 0) {
      const event: Event = eventQueue.pop()!;
      events.push(event);
    }

    if (events.length > 0) {
      console.log(events);
      //_axios.post("http://localhost:8081/event-listener/event/send-events/trlogic", JSON.stringify({events}));
    }
  }, 3000);
};

//  ******************** EVENT HANDLERS  ********************

type NavigationCallback = EventArg<"state", false, { state: NavigationState; }>

const initListener = (triggerSchema: TriggerSchema, trackerVariableSchemas: TrackerVariableSchema[], eventSchema: EventSchema) => {
  switch (triggerSchema.name) {
    case "route":
      navigationRef.current.addListener("state", (state: NavigationCallback) => {
        const trackerVariables: KeyValueMap = {};
        trackerVariableSchemas.forEach(trackerVariableSchema => {
          trackerVariables[trackerVariableSchema.name] = resolveTrackerVariable(trackerVariableSchema, { state });
        });

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
          trackerVariables[trackerVariableSchema.name] = resolveTrackerVariable(trackerVariableSchema, { appState: state });
        });

        const validated: boolean = validate(triggerSchema, trackerVariables);
        if (validated) {
          const event: Event = buildEvent(eventSchema, trackerVariables);
          sendEvent(event);
        }
      });
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
}

//  ******************** TRIGGER ********************
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

declare type ClickOption = { justLinks: boolean }
declare type ScrollOptions = { horizontal: boolean; vertical: boolean; }

interface TriggerSchema {
  name: string;

  filters: Filter[];

  option: ClickOption | ScrollOptions | null,
}

//  ******************** TRACKER VARIABLE ********************
declare type TrackerVariableType = "deviceId" | "deviceName" | "ipAddress" | "route" | "appState" | "javascript";
declare type URLSelection = "full" | "host" | "port" | "path" | "query" | "fragment" | "protocol";
declare type HistorySelection = "newUrl" | "oldUrl" | "newState" | "oldState" | "changeSource";

declare type JavascriptOption = { code: string; }

interface TrackerVariableSchema {
  type: TrackerVariableType;

  name: string;

  option: JavascriptOption | null;
}

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

const resolveTrackerVariable = (trackerVariableSchema: TrackerVariableSchema, event: { state?: NavigationCallback, appState?: AppStateStatus }): string => {
  switch (trackerVariableSchema.type) {
    case "javascript":
      return resolveJavascriptVariable(trackerVariableSchema);
    case "appState":
      return event.appState || "";
    case "deviceId":
      return DeviceInfo.getDeviceId();
    case "deviceName":
      return DeviceInfo.getDeviceNameSync();
    case "ipAddress":
      return DeviceInfo.getIpAddressSync();
    case "route":
      return resolveRouteVariable(trackerVariableSchema, event);
    default :
      return "";
  }
};

const resolveRouteVariable = (trackerVariableSchema: TrackerVariableSchema, event: { state?: NavigationCallback, appState?: AppStateStatus }): string => {
  let currentRoute = "";
  const history = event.state?.data?.state?.history;
  if (history != undefined && Array.isArray(history)) {
    const currentRouteKey: string = history[history.length - 1].key;
    currentRoute = currentRouteKey.split("-")[0];
  }
  return currentRoute;
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
  return { name, actor, variables };
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
