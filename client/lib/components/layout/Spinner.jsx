// Alias de rétrocompatibilité — le composant canonique est lib/components/ui/Spinner.jsx
// Ancienne API : size='w-16 h-16' (Tailwind class) → ignorée, taille md par défaut
import Spinner from '../UI/Spinner';

const LayoutSpinner = ({ className = '' }) => <Spinner size="md" centered className={className} />;

export default LayoutSpinner;
