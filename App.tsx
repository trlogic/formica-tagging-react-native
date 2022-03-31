/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import Home from "./src/Home";
import { Component, MutableRefObject, ReactNode } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Market from "./src/Market";
import { run } from "./tracker";

const Tab = createBottomTabNavigator();

class App extends Component {

  private navigationRef: MutableRefObject<any> = React.createRef();

  public render(): ReactNode {
    return (
      <NavigationContainer ref={this.navigationRef}>
        <Tab.Navigator>
          <Tab.Screen name="Home" component={Home} />
          <Tab.Screen name="Market" component={Market} />
        </Tab.Navigator>
      </NavigationContainer>
    );
  }

  componentDidMount() {
    run(this.navigationRef);
  }

}

export default App;
