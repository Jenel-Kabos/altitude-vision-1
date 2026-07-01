// Alias de rétrocompatibilité — le composant canonique est lib/components/ui/Spinner.jsx
import Spinner from '../ui/Spinner';

export default function LoadingSpinner() {
  return <Spinner size="md" centered />;
}
