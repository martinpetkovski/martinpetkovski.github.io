void print_vector(vector&lt;int&gt; vector_to_print)
{
	for (int i = 0; i &lt; vector_to_print.size(); i++)
	{
		cout &lt;&lt; vector_to_print[i] &lt;&lt; " ";
	}

	system("pause");
}

bool is_marked(vector&lt;int&gt; marked, int node_index)
{
	return find(marked.begin(), marked.end(), node_index) != marked.end();
}

vector&lt;int&gt; DFS(AdjacencyListGraph alg, int root_node)
{
	vector&lt;int&gt; the_stack;
	vector&lt;int&gt; marked;

	the_stack.push_back(root_node);
	while (the_stack.size() &gt; 0)
	{
		root_node = the_stack.back();
		the_stack.pop_back();
		if (!is_marked(marked, root_node))
		{
			marked.push_back(root_node);
			vector&lt;int&gt; current_node_connections = alg.get_connections_from_node(root_node);
			for (int i = 0; i &lt; current_node_connections.size(); i++)
			{
				if (!is_marked(marked, current_node_connections[i]))
				{
					the_stack.push_back(current_node_connections[i]);
				}
			}
		}
	}

	return marked;
}