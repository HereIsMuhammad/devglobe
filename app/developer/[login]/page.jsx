import DeveloperActivityPage from '../../../components/DeveloperActivityPage.jsx';

export async function generateMetadata({ params }) {
  const { login } = await params;
  return {
    title: `${login} activity | DevGlobe`,
    description: `Recent public GitHub activity for ${login} on DevGlobe.`,
  };
}

export default async function DeveloperPage({ params }) {
  const { login } = await params;
  return <DeveloperActivityPage login={login} />;
}