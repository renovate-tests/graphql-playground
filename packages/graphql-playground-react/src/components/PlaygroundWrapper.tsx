import * as React from 'react'
import Playground, { Playground as IPlayground } from './Playground'
import { Helmet } from 'react-helmet'
import { GraphQLConfig } from '../graphqlConfig'
import * as yaml from 'js-yaml'
import ProjectsSideNav from './ProjectsSideNav'
import {
  styled,
  ThemeProvider,
  theme as styledTheme,
  keyframes,
} from '../styled'
import OldThemeProvider from './Theme/ThemeProvider'
import { getActiveEndpoints } from './util'
import { ISettings } from '../types'
import { createStructuredSelector } from 'reselect'
import { connect } from 'react-redux'
import { getTheme } from '../state/workspace/reducers'

function getParameterByName(name: string): string | null {
  const url = window.location.href
  name = name.replace(/[\[\]]/g, '\\$&')
  const regexa = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regexa.exec(url)
  if (!results || !results[2]) {
    return null
  }
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

export interface PlaygroundWrapperProps {
  endpoint?: string
  endpointUrl?: string
  subscriptionEndpoint?: string
  setTitle?: boolean
  settings?: ISettings
  folderName?: string
  configString?: string
  showNewWorkspace?: boolean
  isElectron?: boolean
  canSaveConfig?: boolean
  onSaveConfig?: (configString: string) => void
  onNewWorkspace?: () => void
  getRef?: (ref: any) => void
  platformToken?: string
  env?: any
  config?: GraphQLConfig
  configPath?: string
  injectedState?: any
}

export interface ReduxProps {
  theme: string
}

export interface State {
  endpoint: string
  subscriptionPrefix?: string
  subscriptionEndpoint?: string
  shareUrl?: string
  platformToken?: string
  configIsYaml?: boolean
  configString?: string
  activeProjectName?: string
  activeEnv?: string
  headers?: any
}

class PlaygroundWrapper extends React.Component<
  PlaygroundWrapperProps & ReduxProps,
  State
> {
  playground: IPlayground
  constructor(props: PlaygroundWrapperProps & ReduxProps) {
    super(props)
    ;(global as any).m = this

    const configIsYaml = props.configString
      ? this.isConfigYaml(props.configString)
      : false

    const { activeEnv, projectName } = this.getInitialActiveEnv(props.config)

    let headers
    let endpoint =
      props.endpoint ||
      props.endpointUrl ||
      getParameterByName('endpoint') ||
      location.href

    let subscriptionEndpoint: any =
      props.subscriptionEndpoint || getParameterByName('subscriptionEndpoint')

    if (props.configString && props.config && activeEnv) {
      const endpoints = getActiveEndpoints(props.config, activeEnv, projectName)
      endpoint = endpoints.endpoint
      subscriptionEndpoint = endpoints.subscriptionEndpoint
      headers = endpoints.headers
    }

    subscriptionEndpoint =
      this.normalizeSubscriptionUrl(endpoint, subscriptionEndpoint) || undefined

    this.removeLoader()

    this.state = {
      endpoint: this.absolutizeUrl(endpoint),
      platformToken:
        props.platformToken ||
        localStorage.getItem('platform-token') ||
        undefined,
      subscriptionEndpoint,
      configIsYaml,
      configString: props.configString,
      activeEnv,
      activeProjectName: projectName,
      headers,
    }
  }

  removeLoader() {
    const loadingWrapper = document.getElementById('loading-wrapper')
    if (loadingWrapper) {
      loadingWrapper.remove()
    }
  }

  normalizeSubscriptionUrl(endpoint, subscriptionEndpoint) {
    if (subscriptionEndpoint) {
      if (subscriptionEndpoint.startsWith('/')) {
        const secure =
          endpoint.includes('https') || location.href.includes('https')
            ? 's'
            : ''
        return `ws${secure}://${location.host}${subscriptionEndpoint}`
      } else {
        return subscriptionEndpoint.replace(/^http/, 'ws')
      }
    }

    return this.getGraphcoolSubscriptionEndpoint(endpoint).replace(
      /^http/,
      'ws',
    )
  }

  getGraphcoolSubscriptionEndpoint(endpoint) {
    if (endpoint.includes('api.graph.cool')) {
      return `wss://subscriptions.graph.cool/v1/${
        endpoint.split('/').slice(-1)[0]
      }`
    }

    return endpoint
  }

  componentWillReceiveProps(nextProps: PlaygroundWrapperProps & ReduxProps) {
    if (
      nextProps.configString !== this.props.configString &&
      nextProps.configString
    ) {
      const configIsYaml = this.isConfigYaml(nextProps.configString)
      this.setState({ configIsYaml })
    }
  }

  getInitialActiveEnv(
    config?: GraphQLConfig,
  ): { projectName?: string; activeEnv?: string } {
    if (config) {
      if (config.extensions && config.extensions.endpoints) {
        return {
          activeEnv: Object.keys(config.extensions.endpoints)[0],
        }
      }
      if (config.projects) {
        const projectName = Object.keys(config.projects)[0]
        const project = config.projects[projectName]
        if (project.extensions && project.extensions.endpoints) {
          return {
            activeEnv: Object.keys(project.extensions.endpoints)[0],
            projectName,
          }
        }
      }
    }

    return {}
  }

  isConfigYaml(configString: string) {
    try {
      yaml.safeLoad(configString)
      return true
    } catch (e) {
      //
    }
    return false
  }

  absolutizeUrl(url) {
    if (url.startsWith('/')) {
      return location.origin + url
    }

    return url
  }

  componentWillMount() {
    const platformToken = getParameterByName('platform-token')
    if (platformToken && platformToken.length > 0) {
      localStorage.setItem('platform-token', platformToken)
      window.location.replace(window.location.origin + window.location.pathname)
    }
  }

  componentDidMount() {
    if (this.state.subscriptionEndpoint === '') {
      this.updateSubscriptionsUrl()
    }
  }

  render() {
    const title = this.props.setTitle ? (
      <Helmet>
        <title>{this.getTitle()}</title>
      </Helmet>
    ) : null

    const { theme } = this.props
    return (
      <div>
        {title}
        <ThemeProvider theme={{ ...styledTheme, mode: theme } as any}>
          <OldThemeProvider theme={theme}>
            <App>
              {this.props.config &&
                this.state.activeEnv && (
                  <ProjectsSideNav
                    config={this.props.config}
                    folderName={this.props.folderName || 'GraphQL App'}
                    theme={theme}
                    activeEnv={this.state.activeEnv}
                    onSelectEnv={this.handleSelectEnv}
                    onNewWorkspace={this.props.onNewWorkspace}
                    showNewWorkspace={Boolean(this.props.showNewWorkspace)}
                    isElectron={Boolean(this.props.isElectron)}
                    activeProjectName={this.state.activeProjectName}
                    configPath={this.props.configPath}
                  />
                )}
              <Playground
                endpoint={this.state.endpoint}
                subscriptionEndpoint={this.state.subscriptionEndpoint}
                shareUrl={this.state.shareUrl}
                onChangeEndpoint={this.handleChangeEndpoint}
                onChangeSubscriptionsEndpoint={
                  this.handleChangeSubscriptionsEndpoint
                }
                adminAuthToken={this.state.platformToken}
                getRef={this.getPlaygroundRef}
                config={this.props.config!}
                configString={this.state.configString!}
                configIsYaml={this.state.configIsYaml!}
                canSaveConfig={Boolean(this.props.canSaveConfig)}
                onChangeConfig={this.handleChangeConfig}
                onSaveConfig={this.handleSaveConfig}
                onUpdateSessionCount={this.handleUpdateSessionCount}
                fixedEndpoints={Boolean(this.state.configString)}
                headers={this.state.headers}
                configPath={this.props.configPath}
                workspaceName={this.state.activeProjectName}
              />
            </App>
          </OldThemeProvider>
        </ThemeProvider>
      </div>
    )
  }

  handleUpdateSessionCount = () => {
    this.forceUpdate()
  }

  getPlaygroundRef = ref => {
    this.playground = ref
    if (typeof this.props.getRef === 'function') {
      this.props.getRef(ref)
    }
  }

  handleChangeConfig = (configString: string) => {
    this.setState({ configString })
  }

  handleSaveConfig = () => {
    /* tslint:disable-next-line */
    console.log('handleSaveConfig called')
    if (typeof this.props.onSaveConfig === 'function') {
      /* tslint:disable-next-line */
      console.log('calling this.props.onSaveConfig', this.state.configString)
      this.props.onSaveConfig(this.state.configString!)
    }
  }

  handleSelectEnv = (env: string, projectName?: string) => {
    const { endpoint, subscriptionEndpoint, headers } = getActiveEndpoints(
      this.props.config!,
      env,
      projectName,
    )!
    this.setState({
      activeEnv: env,
      endpoint,
      headers,
      subscriptionEndpoint: this.normalizeSubscriptionUrl(
        endpoint,
        subscriptionEndpoint,
      ),
      activeProjectName: projectName,
    })
  }

  private handleChangeEndpoint = endpoint => {
    this.setState({ endpoint })
  }

  private handleChangeSubscriptionsEndpoint = subscriptionEndpoint => {
    this.setState({ subscriptionEndpoint })
  }

  private getTitle() {
    if (
      this.state.platformToken ||
      this.state.endpoint.includes('api.graph.cool')
    ) {
      const projectId = this.getProjectId(this.state.endpoint)
      const cluster = this.state.endpoint.includes('api.graph.cool')
        ? 'shared'
        : 'local'
      return `${cluster}/${projectId} - Playground`
    }

    return `Playground - ${this.state.endpoint}`
  }

  private async updateSubscriptionsUrl() {
    const candidates = this.getSubscriptionsUrlCandidated(this.state.endpoint)
    const validCandidate = await find(candidates, candidate =>
      this.wsEndpointValid(candidate),
    )
    if (validCandidate) {
      this.setState({ subscriptionEndpoint: validCandidate })
    }
  }

  private getSubscriptionsUrlCandidated(endpoint): string[] {
    const candidates: string[] = []
    candidates.push(endpoint.replace('https', 'wss').replace('http', 'ws'))
    if (endpoint.includes('graph.cool')) {
      candidates.push(
        `wss://subscriptions.graph.cool/v1/${this.getProjectId(endpoint)}`,
      )
    }
    if (endpoint.includes('/simple/v1/')) {
      // it's a graphcool local endpoint
      const host = endpoint.match(/https?:\/\/(.*?)\//)
      candidates.push(
        `ws://${host![1]}/subscriptions/v1/${this.getProjectId(endpoint)}`,
      )
    }
    return candidates
  }

  private wsEndpointValid(url): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new WebSocket(url, 'graphql-ws')
      socket.addEventListener('open', event => {
        socket.send(JSON.stringify({ type: 'connection_init' }))
      })
      socket.addEventListener('message', event => {
        const data = JSON.parse(event.data)
        if (data.type === 'connection_ack') {
          resolve(true)
        }
      })
      socket.addEventListener('error', event => {
        resolve(false)
      })
      setTimeout(() => {
        resolve(false)
      }, 1000)
    })
  }

  private getProjectId(endpoint) {
    return endpoint.split('/').slice(-1)[0]
  }
}

const mapStateToProps = createStructuredSelector({
  theme: getTheme,
})

export default connect(mapStateToProps)(PlaygroundWrapper)

async function find(
  iterable: any[],
  predicate: (item?: any, index?: number) => Promise<boolean>,
): Promise<any | null> {
  for (let i = 0; i < iterable.length; i++) {
    const element = iterable[i]
    const result = await predicate(element, i)
    if (result) {
      return element
    }
  }
  return null
}

const appearIn = keyframes`
  from { 
    opacity: 0;
    transform: translateY(10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
`

const App = styled.div`
  display: flex;
  width: 100%;
  opacity: 0;
  transform: translateY(10px);
  animation: ${appearIn} 0.5s ease-out forwards 0.2s;
`
