import {
  PluginComponentType,
  subscribeToRegistry,
  useActivePlugins,
} from "@fiftyone/plugins";
import * as fos from "@fiftyone/state";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SortableEvent } from "react-sortablejs";
import {
  useRecoilCallback,
  useRecoilState,
  useRecoilValue,
  useSetRecoilState,
} from "recoil";
import SpaceTree from "./SpaceTree";
import { PanelContext } from "./contexts";
import {
  panelStatePartialSelector,
  panelStateSelector,
  panelTitlesState,
  panelsCloseEffect,
  panelsLoadingStateAtom,
  panelsStateAtom,
  previousTabsGroupAtom,
  spaceSelector,
} from "./state";
import {
  PanelsCloseEffect,
  PanelsStateObject,
  SpaceNodeJSON,
  SpaceNodeType,
} from "./types";
import { getNodes } from "./utils";

export function useSpaces(id: string, defaultState?: SpaceNodeJSON) {
  const [state, setState] = useRecoilState(spaceSelector(id));

  useEffect(() => {
    if (!state && defaultState) {
      setState(defaultState);
    }
  }, [state, setState, defaultState]);

  const spaces = new SpaceTree(state, (spaces: SpaceNodeJSON) => {
    setState(spaces);
  });

  const clearSpaces = useCallback(() => {
    setState(undefined);
  }, [setState]);

  return {
    spaces,
    updateSpaces: (
      serializedTreeOrUpdater: (spaces: SpaceTree) => void | SpaceNodeJSON
    ) => {
      if (typeof serializedTreeOrUpdater === "function") {
        setState((latestSpaces) => {
          const spaces = new SpaceTree(latestSpaces);
          serializedTreeOrUpdater(spaces);
          return spaces.toJSON();
        });
      } else {
        setState(serializedTreeOrUpdater);
      }
    },
    clearSpaces,
  };
}

/**
 * Get and set multiple panels state
 */
export function usePanelsState(): [
  PanelsStateObject,
  (newPanelsState: PanelsStateObject) => void
] {
  const [panelsState, setPanelsState] = useRecoilState(panelsStateAtom);

  const state = Object.fromEntries(panelsState);
  function setState(newPanelsState: PanelsStateObject) {
    setPanelsState(new Map(Object.entries(newPanelsState)));
  }

  return [state, setState];
}

export function useSpaceNodes(spaceId: string) {
  const { spaces } = useSpaces(spaceId);

  return useMemo(() => {
    const nodes = getNodes(spaces.root);
    return nodes;
  }, [spaces]);
}

export function usePanels() {
  const schema = useRecoilValue(
    fos.fieldSchema({ space: fos.State.SPACE.SAMPLE })
  );
  const plots = useActivePlugins(PluginComponentType.Plot, { schema });
  const panels = useActivePlugins(PluginComponentType.Panel, { schema });
  return panels.concat(plots);
}

export function usePanel(name: SpaceNodeType) {
  const panels = usePanels();
  return panels.find((panel) => panel.name === name);
}

export function useReactivePanel(name: SpaceNodeType) {
  const [_, setCount] = useState(0);
  useEffect(() => {
    return subscribeToRegistry(() => {
      setCount((count) => count + 1); // trigger re-resolution of panels
    });
  }, []);
  const panels = usePanels();
  return panels.find((panel) => panel.name === name);
}

/**
 * Get and set title of a panel
 *
 * Note: `id` is optional if hook is used within the component of a panel.
 */
export function usePanelTitle(id?: string): [string, (title: string) => void] {
  const panelContext = useContext(PanelContext);
  const [panelTitles, setPanelTitles] = useRecoilState(panelTitlesState);

  const panelId = id || panelContext?.node?.id;
  const panelTitle = panelTitles.get(panelId);

  function setPanelTitle(title: string, id?: string) {
    const updatedPanelTitles = new Map(panelTitles);
    updatedPanelTitles.set(id || panelId, title);
    setPanelTitles(updatedPanelTitles);
  }
  return [panelTitle, setPanelTitle];
}

/**
 * Get and set loading state of a panel
 *
 * Note: `id` is optional if hook is used within the component of a panel.
 */
export function usePanelLoading(
  id?: string
): [boolean, (loading: boolean, id?: string) => void] {
  const panelContext = useContext(PanelContext);
  const [panelsLoadingState, setPanelsLoadingState] = useRecoilState(
    panelsLoadingStateAtom
  );

  const panelId = (id || panelContext?.node?.id) as string;
  const panelLoading = Boolean(panelsLoadingState.get(panelId));

  const setPanelLoading = useCallback(
    (loading: boolean, id?: string) => {
      setPanelsLoadingState((panelsLoading) => {
        const updatedPanelsLoading = new Map(panelsLoading);
        updatedPanelsLoading.set(id || panelId, loading);
        return updatedPanelsLoading;
      });
    },
    [panelId, setPanelsLoadingState]
  );

  return [panelLoading, setPanelLoading];
}

export function usePanelContext() {
  return useContext(PanelContext);
}

/**
 * Get and set state of a panel
 *
 * Note: `id` is optional if hook is used within the component of a panel.
 */
export function usePanelState<T>(
  defaultState?: T,
  id?: string,
  local?: boolean
) {
  const panelContext = usePanelContext();
  const panelId = id || (panelContext?.node?.id as string);
  const [state, setState] = useRecoilState<T>(
    panelStateSelector({ panelId, local })
  );
  const computedState = state || defaultState;

  return [computedState, setState];
}

export function useSetPanelStateById<T>(local?: boolean) {
  return useRecoilCallback(
    ({ set, snapshot }) =>
      async (panelId: string, fn: (state: any) => any) => {
        const panelState = await snapshot.getPromise(
          panelStateSelector({ panelId, local })
        );
        const updatedValue = fn(panelState);
        set(panelStateSelector({ panelId, local }), updatedValue);
      },
    []
  );
}

export function usePanelId() {
  const panelContext = usePanelContext();
  const panelId = panelContext?.node?.id as string;
  return panelId;
}

export function useSetCustomPanelState<T>(local?: boolean) {
  const [panelState, setPanelState] = usePanelState<T>(null, undefined, local);
  return (fn: (state: T) => T) => {
    setPanelState((panelState) => {
      const customPanelState = fn(panelState?.state || {});
      const state = fn(customPanelState);
      return { ...panelState, state };
    });
  };
}

/**
 * Can only be used within a panel component
 */
export function usePanelStateCallback<T>(
  callback: (panelState: T) => void,
  local?: boolean
) {
  const panelContext = usePanelContext();
  const panelId = panelContext?.node?.id as string;
  return useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const panelState = await snapshot.getPromise(
          panelStateSelector({ panelId, local })
        );
        callback(panelState);
      },
    []
  );
}

export function usePanelStateByIdCallback<T>(
  callback: (panelId: string, panelState: T, args: any[]) => void,
  local?: boolean
) {
  return useRecoilCallback(
    ({ snapshot }) =>
      async (panelId: string, ...args) => {
        const panelState = await snapshot.getPromise(
          panelStateSelector({ panelId, local })
        );
        callback(panelId, panelState, args as any[]);
      },
    []
  );
}

/**
 * Lazily read panel state on demand
 * @returns a state resolver function which return promise that resolves to the
 * current state of a panel
 */
export function usePanelStateLazy(local?: boolean) {
  const panelContext = usePanelContext();
  const panelId = panelContext?.node?.id as string;

  const resolvePanelState = useRecoilCallback(
    ({ snapshot }) =>
      async () =>
        snapshot.getPromise(panelStateSelector({ panelId, local }))
  );

  return () => resolvePanelState();
}

/**
 * Get partial state of current panel (i.e. property of an object state)
 *
 * Should only be used within a panel component whose state is an object or
 *  an array
 */
export function usePanelStatePartial<T>(
  key: string,
  defaultState: T,
  local?: boolean
) {
  const panelContext = usePanelContext();
  const panelId = panelContext?.node?.id as string;
  const [state, setState] = useRecoilState<T>(
    panelStatePartialSelector({ panelId, key, local })
  );
  const computedState = useComputedState(state, defaultState);
  return [computedState, setState];
}

function useComputedState(state: any, defaultState: any) {
  const defaultRef = useRef(defaultState);
  return state === undefined ? defaultRef.current : state;
}

export function usePanelTabAutoPosition() {
  const setPreviousTabGroup = useSetRecoilState(previousTabsGroupAtom);
  const getPreviousTabGroup = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        return snapshot.getPromise(previousTabsGroupAtom);
      },
    []
  );

  function autoPositionElement(group: HTMLElement, item?: HTMLElement) {
    const lastChild = group.lastChild as HTMLElement;

    if (!lastChild) return;

    const secondLastChild = lastChild.previousSibling as HTMLElement;
    const lastChildIsIgnored = lastChild.classList.contains("sortable-ignore");

    if (!lastChildIsIgnored && secondLastChild) {
      lastChild.style.transform = `translate(-${secondLastChild.offsetWidth}px)`;
      secondLastChild.style.transform = `translate(${lastChild.offsetWidth}px)`;
    } else if (lastChildIsIgnored) {
      lastChild.style.transform = "none";
      if (secondLastChild) secondLastChild.style.transform = "none";
      if (item) item.style.transform = "none";
    }
  }

  async function autoPosition(e: SortableEvent) {
    const previousTabGroup = await getPreviousTabGroup();
    if (previousTabGroup && e.to != previousTabGroup) {
      autoPositionElement(previousTabGroup);
      setPreviousTabGroup(null);
    }
    const { from, to, item } = e;
    if (from != to) {
      autoPositionElement(from, item);
      autoPositionElement(to, item);
      setPreviousTabGroup(to);
    } else {
      autoPositionElement(to, item);
    }
  }

  return autoPosition;
}

export function useSetPanelCloseEffect(panelId?: string) {
  const panelContext = usePanelContext();
  const computedPanelId = panelId || (panelContext?.node?.id as string);

  return (effect: PanelsCloseEffect[string]) => {
    panelsCloseEffect[computedPanelId] = effect;
  };
}

export function usePanelCloseEffect(panelId?: string) {
  const panelContext = usePanelContext();
  const computedPanelId = panelId || (panelContext?.node?.id as string);

  return () => {
    const panelCloseEffect = panelsCloseEffect[computedPanelId];
    if (panelCloseEffect) {
      delete panelsCloseEffect[computedPanelId];
      panelCloseEffect();
    }
  };
}
