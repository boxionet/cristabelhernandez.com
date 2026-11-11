import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

// Typed Redux hooks — the only way components should touch the store.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
