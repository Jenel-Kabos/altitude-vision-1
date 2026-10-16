import { expect, test } from './external-network.fixture';
import { loginThroughUi } from './support/auth';
import { selectAdministeredTenant } from './support/platformContext';

const admin = { email:'owner-e2e@example.test', password:'E2eOwner!2026' };
// F-U2.14 : connexion partagée robuste ; l'opérateur administre la gestion
// locative dans l'organisation sélectionnée.
async function login(page) { await loginThroughUi(page, admin); }

test('active un Property non publié en Gestion locative, actualise liste et KPI sans publication',async({page,request},testInfo)=>{
  const title=testInfo.project.name==='mobile-chromium'?'Bien privé Gestion E2E Mobile':'Bien privé Gestion E2E';
  await login(page); await page.goto('/dashboard/gestion-locative'); await selectAdministeredTenant(page, 'Tenant E2E');
  const managedTab=page.getByRole('button',{name:/Biens gérés/i});
  const managedBefore=Number((await managedTab.textContent()).match(/\d+/)?.[0]||0);
  await managedTab.click();
  await page.getByRole('button',{name:'Ajouter un bien à la gestion locative'}).first().click({force:true});
  // F-U2.14 : sélecteur par le sens (liste des biens, titre exact) et non par
  // position — la Vue opérateur ajoute un sélecteur de contexte en tête de page,
  // et « Bien privé Gestion E2E » est aussi un préfixe de la variante Mobile.
  const select=page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'Sélectionner un bien' }) });
  const option=select.locator('option',{hasText:new RegExp(`— ${title} —`)});
  await expect(option).toHaveCount(1); await select.selectOption(await option.getAttribute('value'));
  const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/rental-management/onboarding')&&r.request().method()==='POST'),page.getByRole('button',{name:'Activer en gestion locative'}).click()]);
  const body=await response.json(); expect(response.status(),JSON.stringify(body)).toBe(201); expect(body.data.property.isPublished).toBe(false); expect(body.data.rental.managementActivated).toBe(true);
  await expect(page.getByText('Le bien a été ajouté à la Gestion locative.')).toBeVisible(); await expect(page.getByText(title,{exact:true})).toBeVisible();
  const publicList=await request.get('http://localhost:5000/api/properties?status=location&limit=1000'); expect((await publicList.json()).data.properties.some(p=>p.title===title)).toBe(false);
  await expect(managedTab).toContainText(String(managedBefore+1));
});
