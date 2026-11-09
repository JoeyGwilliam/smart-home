import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import type { Forecast } from '@/weather/forecast'
import { fetchForecast } from '@/weather/openMeteo'

// Open-Meteo updates its forecasts about every 15 minutes, so refreshing more often would only repeat requests.
const REFRESH_INTERVAL_MILLISECONDS = 10 * 60_000

/**
 * Keeps the forecast up to date, refreshing in the background.
 *
 * @returns The query, whose data is the forecast. If a refresh fails, the last forecast stays available alongside
 *   the error.
 */
export function useForecast(): UseQueryResult<Forecast> {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: fetchForecast,
    refetchInterval: REFRESH_INTERVAL_MILLISECONDS,
  })
}
