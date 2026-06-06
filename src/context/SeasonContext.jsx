import { createContext } from 'react'

export const SeasonContext = createContext({
  activeSeason: null,
  setActiveSeason: () => {},
  refreshSeason: () => {},
  allSeasons: []
})
