import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PublicEstimationWizard, {
  INITIAL_PUBLIC_ESTIMATION,
} from "../components/public-estimation/PublicEstimationWizard";
import api from "../services/api";

vi.mock("../services/api", () => ({ default: { post: vi.fn() } }));
const chooseNeedAndType = (type) => {
  fireEvent.change(
    screen.getByLabelText(/^Pourquoi souhaitez-vous cette estimation/),
    { target: { value: "Vente" } },
  );
  fireEvent.click(screen.getByText("Suivant"));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${type}`) }));
  fireEvent.click(screen.getByText("Suivant"));
};

describe("PublicEstimationWizard — TEST DATA", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    api.post.mockReset();
  });

  test("affiche la progression, valide par étape et permet le retour", () => {
    render(<PublicEstimationWizard />);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    fireEvent.click(screen.getByText("Suivant"));
    expect(screen.getByText(/Choisissez votre objectif/)).toBeInTheDocument();
    fireEvent.change(
      screen.getByLabelText(/^Pourquoi souhaitez-vous cette estimation/),
      { target: { value: "Vente" } },
    );
    fireEvent.click(screen.getByText("Suivant"));
    expect(screen.getByText("Type de bien")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Précédent"));
    expect(screen.getByText("Votre besoin")).toBeInTheDocument();
  });

  test("un terrain nu masque construction et composition", () => {
    render(<PublicEstimationWizard />);
    chooseNeedAndType("Terrain nu");
    expect(screen.getByText("Localisation")).toBeInTheDocument();
    expect(screen.queryByText("Construction")).not.toBeInTheDocument();
  });

  test("un appartement passe de la localisation à la construction sans terrain", () => {
    render(<PublicEstimationWizard />);
    chooseNeedAndType("Appartement");
    fireEvent.change(screen.getByLabelText("Ville *"), {
      target: { value: "TEST DATA CITY" },
    });
    fireEvent.change(screen.getByLabelText("Quartier *"), {
      target: { value: "TEST DATA AREA" },
    });
    fireEvent.click(screen.getByText("Suivant"));
    expect(screen.getByText("Construction")).toBeInTheDocument();
  });

  test("enregistre un brouillon versionné sans fichiers binaires", async () => {
    render(<PublicEstimationWizard />);
    fireEvent.change(
      screen.getByLabelText(/^Pourquoi souhaitez-vous cette estimation/),
      { target: { value: "Achat" } },
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("altimmo-estimation-draft-v2")),
      ).toMatchObject({ draftVersion: 2, form: { valuationPurpose: "Achat" } }),
    );
    expect(localStorage.getItem("altimmo-estimation-draft-v2")).not.toContain(
      "File",
    );
  });

  test("restaure un brouillon, construit le payload et nettoie après succès", async () => {
    const restored = {
      ...INITIAL_PUBLIC_ESTIMATION,
      valuationPurpose: "Vente",
      typeBien: "Terrain nu",
      location: {
        ...INITIAL_PUBLIC_ESTIMATION.location,
        city: "TEST DATA CITY",
        neighborhood: "TEST DATA AREA",
      },
      land: { ...INITIAL_PUBLIC_ESTIMATION.land, surface: "300" },
      contact: {
        ...INITIAL_PUBLIC_ESTIMATION.contact,
        lastName: "TEST DATA CLIENT",
        phone: "+242 000 000 000",
        email: "test@example.com",
      },
    };
    localStorage.setItem(
      "altimmo-estimation-draft-v2",
      JSON.stringify({ draftVersion: 2, savedAt: Date.now(), form: restored }),
    );
    window.confirm.mockReturnValue(true);
    api.post.mockResolvedValue({
      data: { data: { reference: "TEST-DATA-REF", statut: "En attente" } },
    });
    render(<PublicEstimationWizard />);
    for (let index = 0; index < 8; index += 1)
      fireEvent.click(screen.getByText("Suivant"));
    fireEvent.click(screen.getByText(/Je confirme/));
    fireEvent.click(screen.getByText("Envoyer la demande"));
    fireEvent.click(screen.getByText(/Envoi/));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledTimes(1);
    const body = api.post.mock.calls[0][1];
    const payload = JSON.parse(body.get("payload"));
    expect(payload).toMatchObject({
      publicFormVersion: 2,
      typeBien: "Terrain nu",
      surface: 300,
      location: { city: "TEST DATA CITY" },
    });
    expect(await screen.findByText("TEST-DATA-REF")).toBeInTheDocument();
    expect(localStorage.getItem("altimmo-estimation-draft-v2")).toBeNull();
  });

  test("affiche une erreur API contrôlée", async () => {
    api.post.mockRejectedValue({
      response: { data: { message: "TEST DATA API ERROR" } },
    });
    const restored = {
      ...INITIAL_PUBLIC_ESTIMATION,
      valuationPurpose: "Vente",
      typeBien: "Terrain nu",
      location: {
        ...INITIAL_PUBLIC_ESTIMATION.location,
        city: "TEST DATA CITY",
        neighborhood: "TEST DATA AREA",
      },
      land: { ...INITIAL_PUBLIC_ESTIMATION.land, surface: "300" },
      contact: {
        ...INITIAL_PUBLIC_ESTIMATION.contact,
        lastName: "TEST DATA CLIENT",
        phone: "+242 000 000 000",
        email: "test@example.com",
      },
    };
    localStorage.setItem(
      "altimmo-estimation-draft-v2",
      JSON.stringify({ draftVersion: 2, savedAt: Date.now(), form: restored }),
    );
    window.confirm.mockReturnValue(true);
    render(<PublicEstimationWizard />);
    for (let index = 0; index < 8; index += 1)
      fireEvent.click(screen.getByText("Suivant"));
    fireEvent.click(screen.getByText(/Je confirme/));
    fireEvent.click(screen.getByText("Envoyer la demande"));
    expect(await screen.findByText("TEST DATA API ERROR")).toBeInTheDocument();
    expect(localStorage.getItem("altimmo-estimation-draft-v2")).not.toBeNull();
  });
});
