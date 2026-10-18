import { lazy, Suspense, useState } from 'react';
import { GameProvider, useGame, useGameState, type Game } from './session/game.tsx';
import { CalmStatus, RESTING_LINE } from './ui/CalmStates.tsx';
import { LoadingScreen } from './ui/LoadingScreen.tsx';
import { LoginScreen } from './ui/LoginScreen.tsx';
import { NoticeScreen } from './ui/NoticeScreen.tsx';
import { SignUpScreen } from './ui/SignUpScreen.tsx';
import { WorldsScreen } from './ui/WorldsScreen.tsx';

// three.js and the scene load in their own chunk, after the first screen is up.
const IslandCanvas = lazy(() => import('./scene/IslandCanvas.tsx'));

/** The app: one screen per session phase. Screens read the store and call the session; later tickets add theirs here. */
export function App({ game, webgl2 = true }: { game: Game; webgl2?: boolean }) {
  if (!webgl2) {
    return (
      <NoticeScreen
        title="Island Sim"
        line="This device can't show the island yet. A newer phone or browser will."
        picture="/icons/building_island-hall_a.png"
      />
    );
  }
  return (
    <GameProvider game={game}>
      <Screens />
    </GameProvider>
  );
}

function Screens() {
  const phase = useGameState((state) => state.session.phase);
  switch (phase) {
    case 'signed-out':
      return <SignedOut />;
    case 'worlds':
      return <WorldsPhase />;
    case 'update-required':
      return (
        <NoticeScreen title="Time to reload" line="A newer version of the game is ready." picture="/icons/building_island-hall_a.png">
          <button className="notice-button" type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </NoticeScreen>
      );
    case 'resting':
      return <NoticeScreen title={RESTING_LINE} line="Your island is safe and will be here when it wakes." picture="/icons/building_dock_a.png" />;
    case 'playing':
      return <IslandScreen />;
    default:
      return <LoadingScreen />;
  }
}

/** Log in, or sign up with a friend's invite code. */
function SignedOut() {
  const { session } = useGame();
  const [signingUp, setSigningUp] = useState(false);
  if (signingUp) return <SignUpScreen onSignUp={(request) => session.register(request)} onBack={() => setSigningUp(false)} />;
  return <LoginScreen onLogIn={(username, password) => session.logIn(username, password)} onSignUp={() => setSigningUp(true)} />;
}

/** Pick, create or join a world; the creator's invite code lives here. */
function WorldsPhase() {
  const { session } = useGame();
  const account = useGameState((state) => state.session.account);
  const worlds = useGameState((state) => state.session.worlds);
  return (
    <WorldsScreen
      username={account?.username ?? ''}
      worlds={worlds}
      onOpen={(id) => session.openWorld(id)}
      onCreate={(islandName) => session.createWorld(islandName)}
      onJoin={(code, islandName) => session.joinWorld(code, islandName)}
      onRegenerate={(id) => session.regenerateInvite(id)}
      onLogOut={() => session.logOut()}
    />
  );
}

/** The island in 3D, with the loading screen over it until its models are in. */
function IslandScreen() {
  const [ready, setReady] = useState(false);
  return (
    <>
      <Suspense fallback={null}>
        <IslandCanvas onReady={() => setReady(true)} />
      </Suspense>
      <CalmStatus />
      {!ready && (
        <div className="screen-overlay">
          <LoadingScreen />
        </div>
      )}
    </>
  );
}
