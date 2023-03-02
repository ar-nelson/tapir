import { InjectableAbstract } from "$/lib/inject.ts";
import { AbstractRepoService } from "$/lib/repo/RepoFactory.ts";

@InjectableAbstract()
export abstract class LocalRepoService extends AbstractRepoService {}
