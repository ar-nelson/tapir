import { Injector } from "$/lib/inject.ts";
import { DomainTrustStore } from "$/models/DomainTrust.ts";
import { InFollowStore } from "$/models/InFollow.ts";
import { InstanceConfigStore } from "$/models/InstanceConfig.ts";
import { KeyStore } from "$/models/Key.ts";
import { LocalActivityStore } from "$/models/LocalActivity.ts";
import { LocalAttachmentStore } from "$/models/LocalAttachment.ts";
import { LocalMediaStore } from "$/models/LocalMedia.ts";
import { LocalPostStore } from "$/models/LocalPost.ts";
import { PersonaStore } from "$/models/Persona.ts";
import { ProfileTrustStore } from "$/models/ProfileTrust.ts";
import { RemoteInstanceStore } from "$/models/RemoteInstance.ts";
import { RemoteMediaStore } from "$/models/RemoteMedia.ts";
import { RemotePostStore } from "$/models/RemotePost.ts";
import { RemoteProfileStore } from "$/models/RemoteProfile.ts";
import { TapirConfig } from "$/models/TapirConfig.ts";
import { HttpClientService } from "$/services/HttpClientService.ts";
import { HttpDispatcher } from "$/services/HttpDispatcher.ts";
import { RemoteFetcherService } from "$/services/RemoteFetcherService.ts";
import { SchedulerService } from "$/services/SchedulerService.ts";
import "$/services/protocol-fetchers/LocalFetcherImpl.ts";
import { MockDomainTrustStore } from "./MockDomainTrustStore.ts";
import { MockHttpClientService } from "./MockHttpClientService.ts";
import { MockHttpDispatcher } from "./MockHttpDispatcher.ts";
import { MockInFollowStore } from "./MockInFollowStore.ts";
import { MockInstanceConfigStore } from "./MockInstanceConfigStore.ts";
import { MockKeyStore } from "./MockKeyStore.ts";
import { MockLocalActivityStore } from "./MockLocalActivityStore.ts";
import { MockLocalAttachmentStore } from "./MockLocalAttachmentStore.ts";
import { MockLocalPostStore } from "./MockLocalPostStore.ts";
import { MockLocalMediaStore, MockRemoteMediaStore } from "./MockMediaStore.ts";
import { MockPersonaStore } from "./MockPersonaStore.ts";
import { MockProfileTrustStore } from "./MockProfileTrustStore.ts";
import { MockRemoteFetcherService } from "./MockRemoteFetcherService.ts";
import { MockRemoteInstanceStore } from "./MockRemoteInstanceStore.ts";
import { MockRemotePostStore } from "./MockRemotePostStore.ts";
import { MockRemoteProfileStore } from "./MockRemoteProfileStore.ts";
import { MockSchedulerService } from "./MockSchedulerService.ts";
import { InjectableMockTapirConfig } from "./MockTapirConfig.ts";

export const MockInjector = new Injector(
  [TapirConfig, InjectableMockTapirConfig],
  [InstanceConfigStore, MockInstanceConfigStore],
  [DomainTrustStore, MockDomainTrustStore],
  [ProfileTrustStore, MockProfileTrustStore],
  [KeyStore, MockKeyStore],
  [LocalActivityStore, MockLocalActivityStore],
  [LocalPostStore, MockLocalPostStore],
  [LocalAttachmentStore, MockLocalAttachmentStore],
  [LocalMediaStore, MockLocalMediaStore],
  [PersonaStore, MockPersonaStore],
  [InFollowStore, MockInFollowStore],
  [RemoteInstanceStore, MockRemoteInstanceStore],
  [RemoteProfileStore, MockRemoteProfileStore],
  [RemotePostStore, MockRemotePostStore],
  [RemoteMediaStore, MockRemoteMediaStore],
  [HttpClientService, MockHttpClientService],
  [HttpDispatcher, MockHttpDispatcher],
  [SchedulerService, MockSchedulerService],
  [RemoteFetcherService, MockRemoteFetcherService],
);
