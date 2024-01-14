import type { Repo } from '@automerge/automerge-repo'
import { RepoContext } from '@automerge/automerge-repo-react-hooks'
import type * as Auth from '@localfirst/auth'
import { getShareId, type AuthProvider } from '@localfirst/auth-provider-automerge-repo'
import { createContext, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { actions } from '../store/reducer'
import {
  selectDevice,
  selectRootDocumentId,
  selectShareId,
  selectUser,
  selectUserName,
} from '../store/selectors'
import type { AuthState } from '../types'
import { createRepoWithAuth } from '../util/createRepoWithAuth'
import { getRootDocumentIdFromTeam } from '../util/getRootDocumentIdFromTeam'
import { Card } from './Card'
import { FirstUseSetup } from './FirstUseSetup'
import { Layout } from './Layout'
import { RequestUserName } from './RequestUserName'

const { setDevice, setUser, setShareId, setUserName, setRootDocumentId } = actions

export const LocalFirstAuthContext = createContext<AuthState | undefined>(undefined)

export const LocalFirstAuthProvider = ({ children }: Props) => {
  // persisted state
  const dispatch = useDispatch()
  const device = useSelector(selectDevice)
  const userName = useSelector(selectUserName)
  const user = useSelector(selectUser)
  const shareId = useSelector(selectShareId)
  const rootDocumentId = useSelector(selectRootDocumentId)

  // component state
  const [team, setTeam] = useState<Auth.Team>()
  const [auth, setAuth] = useState<AuthProvider>()
  const [repo, setRepo] = useState<Repo>()

  useEffect(
    () => {
      if (device && user && shareId && rootDocumentId && (!auth || !repo)) {
        // We've used the app before - instantiate the auth provider and the repo.
        createRepoWithAuth({ user, device })
          .then(({ auth, repo }) => {
            // Get the team from the auth provider (which will have loaded it from storage).
            const team = auth.getTeam(shareId)

            // Make sure the team has the correct rootDocumentId
            const rootDocumentIdFromTeam = getRootDocumentIdFromTeam(team!)
            if (rootDocumentIdFromTeam !== rootDocumentId) {
              throw new Error('Team has a different rootDocumentId')
            }
            dispatch(setRootDocumentId(rootDocumentId))
            setTeam(team)
            setAuth(auth)
            setRepo(repo)
          })
          .catch(error => {
            throw error as Error
          })
      }
    },
    [] // only run this effect on first render
  )

  if (!userName)
    return (
      <Layout>
        <Card>
          <RequestUserName
            onSubmit={(userName: string) => {
              dispatch(setUserName(userName))
            }}
          />
        </Card>
      </Layout>
    )

  if (!device || !user || !shareId) {
    // This is our first time using the app - obtain device, user, and team
    return (
      <Layout>
        <Card>
          <FirstUseSetup
            userName={userName}
            onSetup={async ({ device, user, team, auth, repo, rootDocumentId }) => {
              // Store these in local storage
              dispatch(setUser(user))
              dispatch(setDevice(device))
              dispatch(setShareId(getShareId(team)))
              dispatch(setRootDocumentId(rootDocumentId))

              // Store these in component state
              setTeam(team)
              setAuth(auth)
              setRepo(repo)
            }}
          />
        </Card>
      </Layout>
    )
  }

  if (rootDocumentId && repo && team && auth) {
    return (
      <LocalFirstAuthContext.Provider value={{ device, user, team, auth }}>
        <RepoContext.Provider value={repo}>
          {/**/}
          {children}
        </RepoContext.Provider>
      </LocalFirstAuthContext.Provider>
    )
  }

  return <div>Loading...</div>
}

type Props = {
  userName?: string
  deviceName?: string
  children?: React.ReactNode
}
