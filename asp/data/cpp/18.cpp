vector&lt;int&gt; BFS(AdjacencyListGraph alg, int root_node)
{
	queue&lt;int&gt; the_queue;
	vector&lt;int&gt; marked;

	the_queue.push(root_node);

	while (the_queue.size() &gt; 0)
	{
		root_node = the_queue.front();
		the_queue.pop();

		if (!is_marked(marked, root_node))
		{
			vector&lt;int&gt; current_node_connections = alg.get_connections_from_node(root_node);
			marked.push_back(root_node);

			for (int i = 0; i &lt; current_node_connections.size(); i++)
			{
				if (!is_marked(marked, current_node_connections[i]))
				{
					the_queue.push(current_node_connections[i]);
				}
			}
		}
	}

	return marked;
}