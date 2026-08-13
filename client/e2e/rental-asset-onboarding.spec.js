import { expect, test } from './external-network.fixture';

const admin = { email:'owner-e2e@example.test', password:'E2eOwner!2026' };
async function login(page) {
  await page.goto('/login'); await page.locator('#email').fill(admin.email); await page.locator('#password').fill(admin.password);
  await page.getByRole('button',{name:/se connecter/i}).click(); await expect(page).not.toHaveURL(/\/login/,{timeout:20000});
  const consent=page.getByRole('button',{name:'Tout accepter',exact:true}); if(await consent.isVisible().catch(()=>false)) await consent.click();
}

test('active un Property non publié en Gestion locative, actualise liste et KPI sans publication',async({page,request},testInfo)=>{
  const title=testInfo.project.name==='mobile-chromium'?'Bien privé Gestion E2E Mobile':'Bien privé Gestion E2E';
  await login(page); await page.goto('/dashboard/gestion-locative');
  const managedTab=page.getByRole('button',{name:/Biens gérés/i});
  const managedBefore=Number((await managedTab.textContent()).match(/\d+/)?.[0]||0);
  await managedTab.click();
  await page.getByRole('button',{name:'Ajouter un bien à la gestion locative'}).first().click({force:true});
  const select=page.getByRole('combobox').nth(1);
  const option=select.locator('option',{hasText:title}).first();
  await expect(option).toHaveCount(1); await select.selectOption(await option.getAttribute('value'));
  const [response]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/rental-management/onboarding')&&r.request().method()==='POST'),page.getByRole('button',{name:'Activer en gestion locative'}).click()]);
  const body=await response.json(); expect(response.status(),JSON.stringify(body)).toBe(201); expect(body.data.property.isPublished).toBe(false); expect(body.data.rental.managementActivated).toBe(true);
  await expect(page.getByText('Le bien a été ajouté à la Gestion locative.')).toBeVisible(); await expect(page.getByText(title,{exact:true})).toBeVisible();
  const publicList=await request.get('http://localhost:5000/api/properties?status=location&limit=1000'); expect((await publicList.json()).data.properties.some(p=>p.title===title)).toBe(false);
  await expect(managedTab).toContainText(String(managedBefore+1));
});
