import { createContext, useContext } from 'react';

export const OnlineContext = createContext<boolean>(true);

export function useOnlineContext(): boolean {
  return useContext(OnlineContext);
}
