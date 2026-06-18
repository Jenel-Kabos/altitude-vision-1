import { createStackNavigator } from '@react-navigation/stack';
import ConversationsScreen from '../../screens/Messagerie/ConversationsScreen';
import ChatScreen from '../../screens/Messagerie/ChatScreen';

const Stack = createStackNavigator();

export default function MessagerieStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Conversations" component={ConversationsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
