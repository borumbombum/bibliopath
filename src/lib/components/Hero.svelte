<script>
	import { AppConfig } from '$lib';
	import { Zap } from '@lucide/svelte';
</script>

<!-- Header -->
<div class="mb-8 text-center">
	<p class="text-base-content/70 mx-auto mt-5 mb-2 px-2 text-[15px] md:w-2/3 md:px-0 md:text-2xl">
		Bibliopath is a
		<strong class="text-base-content">Nostr-powered web-based ebook reader</strong>
		designed for freedom and a
		<strong class="text-base-content">
			platform for authors to permissionless publish Creative Common books for the open-web
		</strong>, so readers can reader them without intermediaries, and fund them via zaps.
	</p>
	<div class="mx-auto flex w-fit items-center justify-between gap-5">
		<a
			target="_blank"
			rel="nofollow noopener"
			href={AppConfig.links.donate}
			class="btn btn-sm mx-auto my-5 flex w-fit items-center"
		>
			<Zap class="h-4 text-[#FACE3C]" fill="#FACE3C" />
			<span> Consider zapping a coffee</span>
		</a>
		<!-- <div class="divider divider-horizontal">OR</div> -->
		<a
			target="_blank"
			rel="nofollow noopener"
			class="btn btn-sm btn-ghost"
			href={AppConfig.links.about}>Learn more</a
		>
	</div>
</div>
